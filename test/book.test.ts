import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRiskRs, bookCount, currentLimits, pickRegime, regimeDroppedToday, trackerDropped } from '../src/engine/book.ts';
import { legacyAdvice, legacyGiveBack, legacyKept, legacyPrice } from '../src/engine/legacy.ts';
import { halvingState, freshMoney } from '../src/engine/journal.ts';
import { LIMITS_V9 } from '../src/engine/setups.ts';
import type { TrackerRow } from '../src/engine/regime.ts';

const V9 = { v9: true }; // replays compare with v9's own code, so use v9's behaviour
const G = JSON.parse(readFileSync(new URL('../fixtures/expected/book-v9.json', import.meta.url), 'utf8'));
const clean = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'NaN' : x === undefined ? null : x)));
// golden JSON has no undefined; absent fields are simply missing, which matches optional fields
const nul = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

// Replay: the ported functions give the same answers as the original v9 code on the same inputs.
test('legacy advice text, price, gain and give-back % equal v9 on 700 holdings', () => {
  for (const c of G.legacy) {
    const a = legacyAdvice(c.l, nul(c.f), c.cap, c.counts, 'india');
    const gbp = Number.isFinite(a.giveBackPct) ? a.giveBackPct.toFixed(2) + '%' : '—';
    assert.equal(a.todo, c.expected.todo);
    assert.equal(gbp, c.expected.gbp);
    assert.equal(Number.isFinite(a.price) ? String(a.price) : '', c.expected.price);
    assert.equal(String(a.gain), c.expected.gain);
  }
});
test('give-back, open risk and whole-book count equal v9 on 250 books', () => {
  for (const b of G.books) {
    const feed = (s: string) => b.feed[s] ?? null;
    assert.equal(legacyGiveBack(b.docs, feed), b.expected.legacyGiveBack);
    assert.equal(openRiskRs(b.open), b.expected.openRisk);
    const kept = legacyKept(b.docs).length;
    const unchecked = b.docs.filter((l: { status?: string }) => !l.status || l.status === 'unchecked').length;
    assert.equal(bookCount('india', b.open.length, kept, unchecked), b.expected.bookIndia);
    assert.equal(bookCount('us', b.open.length, kept, unchecked), b.expected.bookUs);
  }
});
test("today's limits (with risk adjustments) and the regime-drop flag equal v9 on 300 synthetic desks", () => {
  let withLimits = 0, dropped = 0;
  for (const c of G.limits) {
    const rows: TrackerRow[] = c.len ? G.series.slice(0, c.len).map((r: TrackerRow) => ({ ...r, b: { ...r.b } })) : [];
    if (c.dropSma50) delete rows[rows.length - 1].sma50;
    const regime = pickRegime(rows, c.saved, G.today, V9);
    const lim = currentLimits({ market: c.market, today: G.today, regime, table: LIMITS_V9, freshPass: freshMoney(c.closed, c.startCapital).pass, halving: halvingState(c.closed, c.startCapital) });
    assert.deepEqual(clean(lim), c.expected.limits);
    const d = regimeDroppedToday(rows, c.saved, G.today, V9);
    assert.equal(d, c.expected.dropped);
    if (lim) withLimits++; if (d) dropped++;
  }
  assert.ok(withLimits > 250 && dropped > 10);
});

// Rule text (Engine Rules: legacy book, risk adjustments).
const doc = (o = {}) => ({ qty: 100, avg: 100, price: 120, stop: 110, status: 'pass', sector: 'IT', symbol: 'AAA', stock: 'AAA', ...o });
test('legacy: give-back is qty x (price - stop), floored at zero, kept holdings only', () => {
  const docs = [doc(), doc({ symbol: 'B', stop: 130 }), doc({ symbol: 'C', status: 'fail' })];
  assert.equal(legacyGiveBack(docs, () => null), 100 * (120 - 110));
});
test('legacy: a newer feed close replaces the typed price; otherwise the typed price stays', () => {
  assert.equal(legacyPrice(doc({ priceDate: '2026-10-01' }), { close: 125, date: '2026-10-05' }), 125);
  assert.equal(legacyPrice(doc({ priceDate: '2026-10-05' }), { close: 125, date: '2026-10-05' }), 120);
});
test('legacy: give-back above 1% says tighten or trim; above 3% budget handled by the book', () => {
  const a = legacyAdvice(doc({ qty: 1000, price: 120, stop: 100, swingLow: 100, wk10: 100 }), null, 1_000_000, {});
  assert.match(a.todo, /Give-back 2\.00% is above 1%: tighten, or trim to 500 shares\./);
});
test('legacy: stop is raised to the higher of 10-week average and swing low, and never suggested downward', () => {
  const up = legacyAdvice(doc({ stop: 100, wk10: 108, swingLow: 104, qty: 10 }), null, 1_000_000, {});
  assert.match(up.todo, /Raise the stop to ₹108\.00\./);
  const same = legacyAdvice(doc({ stop: 110, wk10: 100, swingLow: 90, qty: 10 }), null, 1_000_000, {});
  assert.doesNotMatch(same.todo, /Raise the stop/);
});
test('legacy: a holding above 20% of capital is trimmed; more than 3 in a sector triggers the sector limit', () => {
  assert.match(legacyAdvice(doc({ qty: 3000, price: 120 }), null, 1_000_000, {}).todo, /Above 20% of capital: trim to 1666 shares\./);
  assert.match(legacyAdvice(doc({ qty: 10 }), null, 1_000_000, { IT: 4 }).todo, /IT has 4 kept\/open positions: keep at most 3\./);
});
test('book: whole-book count is open + kept + unchecked in India, open only in the US', () => {
  assert.equal(bookCount('india', 3, 4, 2), 9); assert.equal(bookCount('us', 3, 4, 2), 3);
});
test('book: open risk uses average cost over current stop, never negative, and skips trades with no stop', () => {
  const t = { stop: 90, lots: [{ shares: 100, price: 100 }], sells: [] };
  assert.equal(openRiskRs([t, { ...t, stop: 120 }, { lots: t.lots, sells: [] }]), 1000);
});
const none = { halved: false, streakHalved: false, ddHalved: false, dd: 0 };
test('limits: proven Green uses 1% in India only; VIX above 20 halves in India only; halving halves in both', () => {
  const g = { date: '2026-10-05', result: 'green' as const, vix: 22 };
  assert.equal(currentLimits({ market: 'india', today: '2026-10-05', regime: { ...g, vix: 15 }, freshPass: true, halving: none })!.risk, 1);
  assert.equal(currentLimits({ market: 'india', today: '2026-10-05', regime: g, freshPass: true, halving: none })!.risk, 0.5);
  assert.equal(currentLimits({ market: 'us', today: '2026-10-05', regime: g, freshPass: true, halving: none })!.risk, 0.5);
  assert.equal(currentLimits({ market: 'us', today: '2026-10-05', regime: g, freshPass: false, halving: { ...none, halved: true, streakHalved: true } })!.risk, 0.25);
});
test('limits: stale when the regime date is not today; none without a regime', () => {
  assert.equal(currentLimits({ market: 'india', today: '2026-10-05', regime: { date: '2026-10-01', result: 'red' }, freshPass: false, halving: none })!.stale, true);
  assert.equal(currentLimits({ market: 'india', today: '2026-10-05', regime: null, freshPass: false, halving: none }), null);
});
test('regime drop: needs two rows and a complete regime on both', () => {
  assert.equal(trackerDropped([]), false);
  assert.equal(trackerDropped([{ date: '2026-10-05', close: 1 }]), false);
});
