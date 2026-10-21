import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, momentum, verdict, valueAt, shiftMonths, periods, sumSeries, navLookup, BENCHMARKS } from '../src/pm/insight.ts';
import { mergeTax, taxFromLines } from '../src/pm/tax.ts';
import { assetType, isEtf } from '../src/pm/classify.ts';
import rules from '../data/rules/tax.json' with { type: 'json' };

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10));
// an index growing 0.04% a day, and a portfolio growing 0.06% a day from one deposit of 100000
const ds = days('2025-01-01', 400);
const navs = Object.fromEntries(BENCHMARKS.map((b) => [b.id, Object.fromEntries(ds.map((d, i) => [d, 100 * Math.pow(1.0004, i)]))]));
const series = ds.map((d, i) => ({ date: d, value: 100000 * Math.pow(1.0006, i), invested: 100000, missingPrices: 0 }));
const flows = [{ date: '2025-01-01', amount: -100000 }];
const asOf = ds.at(-1)!, heldNow = series.at(-1)!.value;

test('insight: ahead of the index when the portfolio grows faster, with the gap in points', () => {
  const a = analyse({ series, seriesComplete: true, flows, divFlows: [], asOf, heldNow, navs, period: periods([], asOf)[0] });
  assert.ok(a.ok); assert.ok(a.xirr! > a.bench[0].xirr!); assert.ok(a.bench[0].gap! > 0.05);
  assert.equal(Math.round(a.gain), Math.round(heldNow - 100000));
  assert.ok(a.path.length > 300 && a.path.at(-1)!.idx.n50 < a.path.at(-1)!.value, 'index line ends below portfolio line');
  const m = momentum(series, true, flows, asOf, navs.n50);
  assert.equal(m.label, 'Steady');                                         // constant daily growth: no change between quarters
  assert.match(verdict(a, 'n50', m).text, /points ahead of Nifty 50/);
});

test('insight: a period that starts before stored prices is unavailable, not guessed', () => {
  const late = series.slice(100);
  const a = analyse({ series: late, seriesComplete: true, flows, divFlows: [], asOf, heldNow, navs, period: { id: 'x', label: 'FY test', from: '2025-02-01', to: asOf } });
  assert.equal(a.ok, false); assert.match(a.why!, /Stored prices start/);
  assert.equal(valueAt(null, [], '2025-01-01'), 0);
  const noFunds = analyse({ series, seriesComplete: false, flows, divFlows: [], asOf, heldNow, navs, period: { id: 'x', label: 'x', from: '2025-03-01', to: asOf } });
  assert.equal(noFunds.ok, false);
});

test('insight: index fallback when its history starts after the first flow', () => {
  const late = { n50: Object.fromEntries(ds.slice(50).map((d, i) => [d, 100 + i])) };
  const a = analyse({ series, seriesComplete: true, flows, divFlows: [], asOf, heldNow, navs: late, period: periods([], asOf)[0] });
  assert.ok(a.ok); assert.equal(a.bench.find((b) => b.id === 'n50')!.xirr, null); assert.match(a.bench[0].why!, /starts later|history/);
});

test('insight: momentum fades when the recent quarter is weaker', () => {
  const s = ds.map((d, i) => ({ date: d, value: 100000 * (i < 300 ? Math.pow(1.001, i) : Math.pow(1.001, 300) * Math.pow(1.0001, i - 300)), invested: 100000, missingPrices: 0 }));
  assert.equal(momentum(s, true, flows, asOf, undefined).label, 'Fading');
  assert.equal(momentum(null, true, flows, asOf, undefined).label, 'Not enough history');
});

test('insight: dates, financial-year periods and series sums', () => {
  assert.equal(shiftMonths('2026-03-31', -1), '2026-02-28');
  assert.deepEqual(periods(['2024-25', '2025-26'], '2026-10-13').map((p) => p.label), ['Since start', 'FY 2025-26', 'FY 2024-25', 'Last 12 months']);
  assert.equal(periods(['2024-25'], '2026-10-13')[1].from, '2024-03-31');
  assert.equal(sumSeries([[{ date: 'a', value: 1, invested: 1, missingPrices: 0 }], [{ date: 'a', value: 2, invested: 1, missingPrices: 0 }]])[0].value, 3);
  assert.equal(navLookup({ '2025-01-02': 5 })('2025-01-01'), undefined);
});

test('tax: two accounts of one person share one exemption and one set-off', () => {
  const ty = (fyv: string, ltcg: number, stcg: number) => taxFromLines(new Map([[fyv, [{ fy: fyv, type: 'listed_equity' as const, stcg, ltcg, confidence: 'High', unlabeled: 0 }]]]), rules as any);
  const a = ty('2025-26', 100000, 0), b = ty('2025-26', 100000, 0);
  assert.equal(a[0].equity.tax + b[0].equity.tax, 0, 'each alone is under 1.25 lakh');
  const m = mergeTax([a, b], rules as any);
  assert.equal(m[0].equity.ltcg, 200000); assert.equal(m[0].equity.exemptionUsed, 125000); assert.ok(m[0].equity.tax > 0);
  const loss = mergeTax([ty('2025-26', 0, -50000), ty('2025-26', 80000, 0)], rules as any);
  assert.equal(loss[0].equity.taxable.ltcg, 0, 'short-term loss in one account offsets long-term gain in the other');
});

test('classify: international ETFs are recognised from a bare trading symbol, and ETFs show as ETFs', () => {
  for (const s of ['MON100', 'HNGSNGBEES']) assert.equal(assetType({ instrument: s, isin: 'INF000A01012', kind: 'stock' }), 'intl_etf');
  assert.equal(assetType({ instrument: 'ABC', isin: 'INE000A01010', kind: 'stock' }), 'listed_equity');
  assert.ok(isEtf('NIPPON INDIA ETF NIFTY BEES NIFTYBEES', 'listed_equity')); assert.ok(isEtf('MON100', 'intl_etf')); assert.ok(!isEtf('ABC', 'listed_equity'));
});
