import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueRanked, valueLite, qualityRanked, maxDrawdown, fallenPassers, compounderPassers, pead, reviewNow, grahamList, BA, type BCtx, type SignalLogRow } from '../src/engine/batch-a.ts';
import { newBook } from '../src/engine/stock-book.ts';
import type { Features } from '../src/engine/fundamentals-asof.ts';

const N = 300, dates = Array.from({ length: N }, (_, i) => { const d = new Date(Date.UTC(2025, 0, 1) + i * 864e5); return d.toISOString().slice(0, 10); });
const flat = (v: number) => Array.from({ length: N }, () => v);
const ser = (c: number[], v?: number[]) => ({ c, h: c.map((x) => x * 1.01), l: c.map((x) => x * 0.99), v: v ?? flat(1000) });
const feat = (o: Partial<Features> & { ey?: number | null; pat?: number | null } = {}): Features => ({ entity: 'x', t: dates[N - 1], asOf: null, latestPeriod: null, basis: 'consolidated', financial: false, basisBreak: false,
  ttm: { revenue: 1000, pbtPre: 100, pat: o.pat === undefined ? 80 : o.pat, eps: 1, operatingEbit: 100, financeCost: 10, exceptional: 0, pbt: 100 }, ttmPrev: { revenue: 900, pbtPre: 90, pat: 70 }, margin: { operatingEbit: 0.1, pbtPre: 0.1 }, interestCover: 10,
  growth: { revenue: 0.2, pbtPre: 0.1, pat: 0.1, revenueCagr3: 0.15 }, fiscalYears: [], quarterlyEbitMargin: Array(12).fill(0.1), shares: 100, sharesYearAgoRolled: 100, sharesFlag: false, marketCap: 1000, earningsYield: o.ey === undefined ? 0.1 : o.ey, eyNullReason: null,
  bs: null, bsPrev: null, cashFlowFy: [], netDebt: null, enterpriseValue: null, returnOnCapital: null, sue: { value: null, epsChange: null, period: null, reason: 'x' }, missing: [], ...o });
const mk = (syms: string[], fund: Record<string, Features>, o: Partial<BCtx> = {}): BCtx => ({ el: syms.map((s, i) => ({ sym: s, value: 1e8 - i })), series: new Map(syms.map((s) => [s, ser(flat(100))])), t: N - 1, dates, held: new Set(), fund, st: newBook('b', '2025-01-01'), group: () => null, ...o });

test('value: only positive yields, highest first, at most 5 per industry', () => {
  const syms = Array.from({ length: 12 }, (_, i) => `S${i}`), fund = Object.fromEntries(syms.map((s, i) => [s, feat({ ey: 0.2 - i * 0.01 })]));
  fund.S3 = feat({ ey: -0.1 }); fund.S4 = feat({ ey: null });
  const r = valueRanked(mk(syms, fund, { group: (s) => (Number(s.slice(1)) < 8 ? 'A' : 'B') }));
  assert.deepEqual(r.map((x) => x.sym), ['S0', 'S1', 'S2', 'S5', 'S6', 'S8', 'S9', 'S10', 'S11']);   // A: S0 S1 S2 S5 S6 (S3 negative, S4 null, S7 over the cap of 5); B: S8..S11
});
test('review: first session of a month, or the very start of a book that has never filled; otherwise nothing', () => {
  const i = dates.findIndex((d, k) => k > 0 && d.slice(5, 7) !== dates[k - 1].slice(5, 7)), x = mk(['A'], { A: feat() }, { t: i + 5 });
  assert.equal(reviewNow(x), false || !x.st.started && x.held.size === 0);   // fresh book: reviews at the start
  const started = mk(['A'], { A: feat() }, { t: i + 5, held: new Set(['A']) }); started.st.started = '2025-02-02';
  assert.equal(reviewNow(started), false); assert.equal(reviewNow({ ...started, t: i }), true);
  const stopped = mk(['A'], { A: feat() }, { t: i + 5 }); stopped.st.started = '2025-02-02';   // everything stopped out: no daily refilling, wait for the review
  assert.equal(reviewNow(stopped), false); assert.equal(valueLite(stopped), null);
});
test('keep rule: a held name at rank 30 stays; one at rank 45 is sold; places go to the best others', () => {
  const syms = Array.from({ length: 60 }, (_, i) => `S${i}`), fund = Object.fromEntries(syms.map((s, i) => [s, feat({ ey: 0.5 - i * 0.005 })]));
  const x = mk(syms, fund, { held: new Set(['S29', 'S44']) }); x.st.started = '2025-01-05';
  const i = dates.findIndex((d, k) => k > 0 && d.slice(5, 7) !== dates[k - 1].slice(5, 7)); const o = valueLite({ ...x, t: i })!;
  assert.deepEqual(o.sells, ['S44']); assert.equal(o.buys.length, 19); assert.ok(!o.buys.some((b) => b.sym === 'S29'));
});
test('quality: margin is ranked within the industry when it has 5 or more scored names', () => {
  const syms = Array.from({ length: 12 }, (_, i) => `Q${i}`);
  const f = (m: number, sd = 0) => feat({ margin: { operatingEbit: m, pbtPre: m }, quarterlyEbitMargin: Array.from({ length: 12 }, (_, k) => m + (k % 2 ? sd : -sd)) });
  const fund = Object.fromEntries(syms.map((s, i) => [s, f(i < 6 ? 0.30 + i * 0.001 : 0.05 + (i - 6) * 0.001)]));   // industry X (high margin) Q0-5, industry Y (low margin) Q6-11
  const r = qualityRanked(mk(syms, fund, { group: (s) => (Number(s.slice(1)) < 6 ? 'X' : 'Y') }));
  assert.equal(r.length, 12); const top = r.slice(0, 2).map((x) => x.sym); assert.ok(top.some((s) => Number(s.slice(1)) >= 6), 'a low-margin industry leader ranks near the top once margins are compared within industry');
  assert.equal(qualityRanked(mk(syms, { ...fund, Q0: feat({ margin: { operatingEbit: null, pbtPre: null } }) })).some((x) => x.sym === 'Q0'), false);   // a missing figure drops the name
});
test('financials are not scored by quality-lite', () => { assert.equal(qualityRanked(mk(['F'], { F: feat({ financial: true }) })).length, 0); });
test('max drawdown over the window, and a missing window gives null', () => {
  const c = flat(100); for (let i = 100; i < 150; i++) c[i] = 200; for (let i = 150; i < N; i++) c[i] = 90;
  assert.ok(Math.abs((maxDrawdown(c, N - 1, 250) as number) - 0.55) < 1e-9); assert.equal(maxDrawdown(c, N - 1, 1260), null);
});
test('fallen: needs the drawdown, profit, growth above 15%, near the high and cover of 3', () => {
  const c = flat(100); for (let i = 60; i < 80; i++) c[i] = 300; for (let i = 80; i < 200; i++) c[i] = 120; for (let i = 200; i < N; i++) c[i] = 130 + (i - 200);   // fell from 300 to 120, now rising
  const x = mk(['A', 'B', 'C'], { A: feat(), B: feat({ growth: { revenue: 0.1, pbtPre: 0.1, pat: 0.1, revenueCagr3: 0.1 } }), C: feat({ interestCover: 2 }) }); for (const s of ['A', 'B', 'C']) x.series.set(s, ser(c));
  const orig = BA.fallenWindow; (BA as { fallenWindow: number }).fallenWindow = 250; const r = fallenPassers(x); (BA as { fallenWindow: number }).fallenWindow = orig;
  assert.deepEqual(r.map((p) => p.sym), ['A']);
});
test('compounder: four fiscal years each with margin 10%+, rising revenue, profit; five years needed', () => {
  const fy = (rev: number[], m = 0.12) => rev.map((r, i) => ({ end: `20${25 - i}-03-31`, revenue: r, operatingEbit: r * m, pat: r * 0.05 }));
  const x = mk(['A', 'B', 'C', 'D'], { A: feat({ fiscalYears: fy([160, 140, 120, 100, 80]) }), B: feat({ fiscalYears: fy([160, 140, 120, 100]) }), C: feat({ fiscalYears: fy([160, 140, 120, 100, 80], 0.09) }), D: feat({ fiscalYears: fy([160, 170, 120, 100, 80]) }) });
  assert.deepEqual(compounderPassers(x).map((p) => p.sym), ['A']);
});
test('pead: signals on a filing broadcast since the last session, highest SUE first, logs why a name is not bought', () => {
  const D = dates[N - 1], prev = dates[N - 2], f = (sue: number, day: string, o: Partial<Features> = {}) => feat({ asOf: `${day}T18:00:00+05:30`, sue: { value: sue, epsChange: 1, period: '2025-09-30', reason: 'ok' }, ...o });
  const syms = Array.from({ length: 6 }, (_, i) => `P${i}`);
  const fund = { P0: f(3, D), P1: f(5, D), P2: f(1.5, D), P3: f(4, '2025-01-05'), P4: f(6, D, { ttm: { revenue: 1, pbtPre: 1, pat: -5, eps: 1, operatingEbit: 1, financeCost: 0, exceptional: 0, pbt: 1 } }), P5: f(2.5, prev) };
  const x = mk(syms, fund); const log: SignalLogRow[] = [];
  const o = pead(x, [], log)!;
  assert.deepEqual(o.buys.map((b) => b.sym), ['P1', 'P0']);   // P5 was broadcast on the previous session (already signalled then); P2 below 2; P3 old; P4 loss-making
  assert.equal(log.filter((l) => l.taken).length, 2);
  const full = mk(syms, fund, { held: new Set(Array.from({ length: 19 }, (_, i) => `H${i}`)) }); const log2: SignalLogRow[] = [];
  const o2 = pead(full, [], log2)!; assert.deepEqual(o2.buys.map((b) => b.sym), ['P1']); assert.ok(log2.some((l) => l.sym === 'P0' && l.why === 'no slot'));
});
test('pead: a name held for 60 sessions is sold; one held 59 is not', () => {
  const x = mk(['A'], { A: feat() }); x.st.pos = { A: { sh: 1, entry: 100, entryDate: dates[N - 60], high: 100, stop: 0.05 }, B: { sh: 1, entry: 100, entryDate: dates[N - 59], high: 100, stop: 0.05 } };
  x.held = new Set(['A', 'B']); assert.deepEqual(pead(x)!.sells, ['A']);
});
test('pead: a signal with a stop wider than 8% is skipped and listed', () => {
  const D = dates[N - 1]; const x = mk(['W'], { W: feat({ asOf: `${D}T18:00:00+05:30`, sue: { value: 3, epsChange: 1, period: 'p', reason: 'ok' } }) });
  const c = flat(100).map((v, i) => v * (i % 2 ? 1.08 : 0.92)); x.series.set('W', { c, h: c.map((v) => v * 1.06), l: c.map((v) => v * 0.94), v: flat(1000) });
  const wide: Array<{ sym: string; width: number }> = []; assert.equal(pead(x, wide), null); assert.equal(wide[0].sym, 'W');
});
test('graham-lite list: P/E at most 15, profit in every fiscal year, non-financial', () => {
  const fy = (p: number[]) => p.map((v, i) => ({ end: `20${25 - i}-03-31`, revenue: 1, operatingEbit: 1, pat: v }));
  const x = mk(['A', 'B', 'C', 'D'], { A: feat({ ey: 0.1, fiscalYears: fy([5, 4, 3]) }), B: feat({ ey: 0.05, fiscalYears: fy([5, 4, 3]) }), C: feat({ ey: 0.1, fiscalYears: fy([5, -1, 3]) }), D: feat({ ey: 0.1, financial: true, fiscalYears: fy([5]) }) });
  assert.deepEqual(grahamList(x).map((r) => r.sym), ['A']);
});
