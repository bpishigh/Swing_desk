import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrades, journalReport, type HistLot, type Recog } from '../src/pm/swingjournal.ts';
import { limitsFor } from '../src/pm/swingorders.ts';

const rec: Recog = { setup: '4', stop: 90, trigger: 100, tier: 'exact' };
const lot = (key: string, date: string, qty: number, price: number, sells: HistLot['sells'] = []): HistLot => ({ key, date, unitCost: price, qty, sells });
const all = () => rec;
const nm = (k: string) => k.toUpperCase();

test('a fully sold recognised lot is a closed trade scored in R on the units bought', () => {
  // risk 10 a share, 10 shares: 1R = 100. Sold at 120: +200 = +2R
  const [t] = buildTrades([lot('a', '2026-10-19', 10, 100, [{ date: '2026-10-28', qty: 10, price: 120 }])], all, [], {}, nm);
  assert.equal(t.closed, true); assert.equal(Math.round(t.r! * 100) / 100, 2); assert.equal(t.exitDate, '2026-10-28');
});
test('a partly sold lot is open and is marked at the current price; a stop-out is -1R', () => {
  const [o] = buildTrades([lot('a', '2026-10-19', 10, 100, [{ date: '2026-10-22', qty: 4, price: 110 }])], all, [], {}, nm, () => 105);
  assert.equal(o.closed, false); assert.equal(o.heldQty, 6);   // sold 4 at 110 = +40, 6 marked at 105 = +30: 70 / 100
  assert.equal(Math.round(o.r! * 100) / 100, 0.7);
  const [l] = buildTrades([lot('a', '2026-10-19', 10, 100, [{ date: '2026-10-21', qty: 10, price: 90 }])], all, [], {}, nm);
  assert.equal(Math.round(l.r! * 100) / 100, -1);
});
test('lots of one stock on one day are one trade; an owner-confirmed exit closes the trade', () => {
  const t = buildTrades([lot('a', '2026-10-19', 5, 100), lot('a', '2026-10-19', 5, 101)], all, [{ key: 'a', buyDate: '2026-10-19', date: '2026-10-25', qty: 10, price: 112 }], {}, nm);
  assert.equal(t.length, 1); assert.equal(t[0].closed, true); assert.equal(t[0].boughtQty, 10);
});
test('lots that are not recognised are left out', () => {
  assert.equal(buildTrades([lot('a', '2026-10-19', 10, 100, [{ date: '2026-10-21', qty: 10, price: 90 }])], () => null, [], {}, nm).length, 0);
});
const stream = (rs: number[], rules?: 'yes' | 'no'): ReturnType<typeof buildTrades> => buildTrades(rs.map((r, i) => lot('s' + i, `2026-0${1 + Math.floor(i / 10)}-${String(1 + (i % 10) * 2).padStart(2, '0')}`, 10, 100, [{ date: `2026-0${3 + Math.floor(i / 10)}-${String(2 + (i % 10) * 2).padStart(2, '0')}`, qty: 10, price: 100 + r * 10 }])), all, [], rules ? Object.fromEntries(rs.map((_, i) => [`rules:s${i}|2026-0${1 + Math.floor(i / 10)}-${String(1 + (i % 10) * 2).padStart(2, '0')}`, rules])) : {}, nm);
test('three losses in a row halve risk; two winners end it', () => {
  assert.equal(journalReport(stream([1, -1, -1, -1]), 1e6).halving.halved, true);
  assert.equal(journalReport(stream([-1, -1, -1, 1, 1]), 1e6).halving.halved, false);
});
test('Journal Test: not enough trades cannot pass; unanswered rule breaks block a pass; with answers a good run passes', () => {
  const good = Array.from({ length: 24 }, (_, i) => (i % 4 === 3 ? -0.8 : 1));   // wins +1R, losses -0.8R
  const unanswered = journalReport(stream(good), 1e6);
  assert.equal(unanswered.provenGreen, false); assert.ok(unanswered.unrecorded > 0);
  const answered = journalReport(stream(good, 'yes'), 1e6);
  assert.equal(answered.unrecorded, 0); assert.equal(answered.stats.n, 24);
  assert.equal(answered.enough, true); assert.equal(answered.provenGreen, true);
  assert.equal(journalReport(stream(good.slice(0, 10), 'yes'), 1e6).provenGreen, false);   // fewer than 20
  assert.equal(journalReport(stream(good.map((r) => (r < 0 ? -1.5 : r)), 'yes'), 1e6).provenGreen, false);   // average loss above 1.2R
});
test('sizing: proven Green is 1%, VIX and halving each halve, nothing changes without the journal', () => {
  const base = limitsFor('green', 10)!.risk;
  assert.equal(limitsFor('green', 10, { provenGreen: true })!.risk, 1);
  assert.equal(limitsFor('green', 25, { provenGreen: true })!.risk, 0.5);
  assert.equal(limitsFor('green', 10, { halving: { halved: true, streakHalved: true, ddHalved: false, dd: 0 } })!.risk, base / 2);
  assert.equal(limitsFor('yellow', 10, { provenGreen: true })!.risk, limitsFor('yellow', 10)!.risk);
});

test('equity drawdown of 5% halves risk even without a losing streak, and 8% fails the drawdown test', () => {
  // swing capital 1000, each trade risks 100: a win then two losses is not a streak of three, but equity is 10% below its peak
  const j = journalReport(stream([1, -1, -1]), 1000);
  assert.equal(j.halving.streakHalved, false); assert.equal(j.halving.ddHalved, true); assert.equal(j.halving.halved, true);
  assert.equal(j.tests.find((x) => x.k === 'Drawdown from peak')!.pass, false);
});
test('more than two recorded rule breaks in the last 20 fail the Rule breaks test', () => {
  const good = Array.from({ length: 24 }, () => 1);
  const t = stream(good, 'yes'); for (let i = 0; i < 3; i++) { t[t.length - 1 - i].rulesFollowed = false; }
  const j = journalReport(t, 1e6);
  assert.equal(j.tests.find((x) => x.k.startsWith('Rule breaks'))!.pass, false); assert.equal(j.provenGreen, false);
});
