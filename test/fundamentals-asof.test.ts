import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asOfResults, type ResultFact } from '../src/engine/filings-asof.ts';
import { computeFeatures, fiscalEndMonth } from '../src/engine/fundamentals-asof.ts';

const E = 'E1';
const qEnd = (i: number) => { const m = 3 + 3 * (i % 4), y = 2019 + Math.floor((i + 0) / 4); return `${y + (m > 12 ? 1 : 0)}-${String(((m - 1) % 12) + 1).padStart(2, '0')}-${[31, 30, 30, 31][i % 4] === 31 && (i % 4 === 0 || i % 4 === 3) ? '31' : '30'}`; };
// quarter i: 0 = Mar 2019, 1 = Jun 2019, 2 = Sep 2019, 3 = Dec 2019, 4 = Mar 2020 ...
const period = (i: number) => { const y = 2019 + Math.floor(i / 4); return ['03-31', '06-30', '09-30', '12-31'][i % 4] ? `${y}-${['03-31', '06-30', '09-30', '12-31'][i % 4]}` : ''; };
const asOf = (i: number) => { const p = period(i); const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)) + 1; return `${y + (m > 12 ? 1 : 0)}-${String(m > 12 ? m - 12 : m).padStart(2, '0')}-20T10:00:00+05:30`; };
function fact(i: number, o: { rev?: number; pbtPre?: number; exc?: number; fin?: number; other?: number; pat?: number; eps?: number | null; basis?: 'consolidated' | 'standalone'; format?: string; paidUp?: number; bs?: Record<string, number>; ytd?: number | null } = {}): ResultFact {
  const rev = o.rev ?? 1000, pre = o.pbtPre ?? 200, exc = o.exc ?? 0, pat = o.pat ?? 150, eps = o.eps === undefined ? 1.5 : o.eps;
  return { entity: E, period: period(i), basis: o.basis ?? 'consolidated', asOf: asOf(i), revision: 0, format: o.format ?? 'IFIndAs',
    fields: { revenue: rev, pbt: pre + exc, pat, eps }, ytd: { revenue: o.ytd === undefined ? null : o.ytd, pbt: null, pat: null, eps: null },
    extra: { q: { pbtPre: pre, exceptional: exc, financeCost: o.fin ?? 20, otherIncome: o.other ?? 10, paidUp: o.paidUp ?? 1000, faceValue: 10 }, bs: o.bs ?? {}, cf: {} } };
}
const series = (n: number, f: (i: number) => Parameters<typeof fact>[1] = () => ({})): ResultFact[] => Array.from({ length: n }, (_, i) => fact(i, f(i)));
const view = (facts: ResultFact[], t: string) => asOfResults(facts, E, t, { limit: 40 });
const T = '2025-01-10';

test('TTM sums four consecutive quarters; operating EBIT leaves out other income', () => {
  const r = computeFeatures(view(series(20), T), 100, [], { fiscalEnd: 3 });
  assert.equal(r.ttm.revenue, 4000); assert.equal(r.ttm.pat, 600);
  assert.equal(r.ttm.operatingEbit, 4 * (200 + 20 - 10)); assert.equal(r.margin.operatingEbit, 840 / 4000);
  assert.equal(r.interestCover, 840 / 80);
});
test('a missing quarter inside the window makes the TTM null, not a smaller sum', () => {
  const f = series(20).filter((x) => x.period !== period(18));
  const r = computeFeatures(view(f, T), 100, []);
  assert.equal(r.ttm.revenue, null); assert.equal(r.growth.revenue, null);
});
test('growth compares TTM with the TTM a year earlier and is null across a basis change', () => {
  const up = series(20, (i) => ({ rev: i >= 16 ? 1200 : 1000 }));
  assert.equal(computeFeatures(view(up, T), 100, []).growth.revenue, 4800 / 4000 - 1);
  const mixed = series(20, (i) => ({ basis: i >= 16 ? 'standalone' : 'consolidated' }));
  assert.equal(computeFeatures(view(mixed, T), 100, []).growth.revenue, null);
});
test('three-year revenue CAGR needs 16 quarters', () => {
  const g = series(20, (i) => ({ rev: 1000 * Math.pow(1.1, Math.floor(i / 4)) }));
  assert.ok(Math.abs((computeFeatures(view(g, T), 100, []).growth.revenueCagr3 as number) - 0.1) < 0.01);
  assert.equal(computeFeatures(view(series(14), T), 100, []).growth.revenueCagr3, null);
});
test('financial companies get no revenue-based or EBIT-based figures; earnings yield still works', () => {
  const r = computeFeatures(view(series(20, () => ({ format: 'IFBanking' })), T), 100, []);
  assert.equal(r.financial, true); assert.equal(r.ttm.revenue, null); assert.equal(r.ttm.operatingEbit, null); assert.equal(r.interestCover, null);
  assert.notEqual(r.earningsYield, null);
});
test('market cap rolls the share count forward for a bonus after the last filing; earnings yield is TTM profit over market cap', () => {
  const f = series(20); const last = f[19].asOf.slice(0, 10);
  const none = computeFeatures(view(f, '2025-01-10'), 50, []);
  assert.equal(none.shares, 100); assert.equal(none.marketCap, 5000); assert.equal(none.earningsYield, 600 / 5000);
  const split = computeFeatures(view(f, '2025-01-10'), 25, [{ date: '2025-01-05', factor: 0.5 }]);
  assert.ok(last < '2025-01-05'); assert.equal(split.shares, 200); assert.equal(split.marketCap, 5000); assert.equal(split.earningsYield, 600 / 5000);
  const before = computeFeatures(view(f, '2025-01-10'), 50, [{ date: '2024-01-05', factor: 0.5 }]);   // split before the last filing is already in the filed share count
  assert.equal(before.shares, 100);
});
test('earnings yield is null when exceptional items exceed 25% of PBT', () => {
  const r = computeFeatures(view(series(20, (i) => (i === 19 ? { exc: 400 } : {})), T), 50, []);
  assert.equal(r.earningsYield, null); assert.match(r.eyNullReason ?? '', /exceptional/);
});
test('profit before exceptional items is used for margins and growth: a one-off gain does not lift them', () => {
  const r = computeFeatures(view(series(20, (i) => (i === 19 ? { exc: 400 } : {})), T), 50, []);
  assert.equal(r.ttm.pbt, 4 * 200 + 400); assert.equal(r.ttm.pbtPre, 4 * 200);
});
test('fiscal year end is read from the year-to-date columns; fiscal years sum four quarters on that year end', () => {
  const f = series(20, (i) => ({ ytd: 1000 * (((i + 3) % 4) + 1) }));   // March year end: the March quarter is the fourth (ytd = 4 quarters), June the first
  const v = view(f, T); assert.equal(fiscalEndMonth(v), 3);
  const r = computeFeatures(v, 100, []); assert.ok(r.fiscalYears.length >= 3); assert.equal(r.fiscalYears[0].revenue, 4000);
  const d = series(20, (i) => ({ ytd: 1000 * ((i % 4) + 1) }));   // year ends in December: March is the first quarter
  assert.equal(fiscalEndMonth(view(d, T)), 12);
  assert.equal(fiscalEndMonth(view(series(20), T)), null);   // no year-to-date columns: cannot say
});
test('balance sheet: latest filing that carries one, and the one a year earlier', () => {
  const f = series(20, (i) => (i === 19 || i === 15 ? { bs: { assets: 5000 + i, equity: 2000, borrowings: 800, cash: 300, currentAssets: 1500, currentLiabilities: 900, ppe: 2500, borrowingsCurrent: 100 } } : {}));
  const r = computeFeatures(view(f, T), 50, []);
  assert.equal(r.bs?.period, period(19)); assert.equal(r.bsPrev?.period, period(15)); assert.equal(r.netDebt, 500);
  assert.equal(r.enterpriseValue, 5000 + 500);
  const nwc = (1500 - 300) - (900 - 100); assert.equal(r.returnOnCapital, 840 / (nwc + 2500));
});
test('SUE: EPS change over the spread of the previous 8 changes; needs 6 earlier changes and the same basis', () => {
  const eps = [1, 1.1, 1.2, 1.1, 1.3, 1.2, 1.4, 1.3, 1.5, 1.5, 1.6, 1.6, 1.8, 1.7, 1.9, 1.8, 2.0, 2.0, 2.1, 3.5];
  const f = eps.map((e, i) => fact(i, { eps: e }));
  const r = computeFeatures(view(f, T), 100, []);
  const d = (i: number) => eps[i] - eps[i - 4]; const prior = [18, 17, 16, 15, 14, 13, 12, 11].map(d); const m = prior.reduce((a, b) => a + b) / 8; const s = Math.sqrt(prior.reduce((a, b) => a + (b - m) ** 2, 0) / 8);
  assert.equal(r.sue.reason, 'ok'); assert.ok(Math.abs((r.sue.value as number) - d(19) / s) < 1e-9); assert.equal(r.sue.epsChange, d(19));
  assert.equal(computeFeatures(view(f.slice(0, 10), T), 100, []).sue.value, null);
  const flip = f.map((x, i) => (i === 14 ? { ...x, basis: 'standalone' as const } : x));
  assert.equal(computeFeatures(view(flip, T), 100, []).sue.reason, 'ok');   // one earlier change drops out, 7 remain
});
test('nothing filed after t is read', () => {
  const r = computeFeatures(view(series(20), '2023-06-01'), 100, []);
  assert.ok((r.latestPeriod ?? '') < '2023-06-01');
});

test('shares: a filer that enters paid-up capital in crore is read in rupees by checking against profit over EPS; a count that fits no unit is not used', () => {
  const f = series(20).map((x) => ({ ...x, fields: { ...x.fields, pat: 150e7, eps: 1.5 }, extra: { ...x.extra!, q: { ...x.extra!.q, paidUp: 100, faceValue: 1 } } }));   // 100 crore shares of face value 1 entered as 100: implied 100 crore shares
  const r = computeFeatures(view(f, T), 10, []); assert.equal(r.shares, 100e7);
  const bad = series(20).map((x) => ({ ...x, fields: { ...x.fields, pat: 150e7, eps: 1.5 }, extra: { ...x.extra!, q: { ...x.extra!.q, paidUp: 5e9 * 0.2e-3, faceValue: 1 } } }));   // 1e6 shares against an implied 1e9: out by 1000 is allowed, out by a non-unit factor is not
  void bad;
  const odd = series(20).map((x) => ({ ...x, fields: { ...x.fields, pat: 150e7, eps: 1.5 }, extra: { ...x.extra!, q: { ...x.extra!.q, paidUp: 3.3e7, faceValue: 1 } } }));   // 3.3e7 over implied 1e9: closest unit leaves a factor of 3.03
  assert.equal(computeFeatures(view(odd, T), 10, []).shares, null);
});
