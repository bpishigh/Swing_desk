import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuarters, monthEnd, formatOfSic, trim } from '../src/ingest/edgar-facts.ts';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures } from '../src/engine/fundamentals-asof.ts';
const load = (t: string) => JSON.parse(readFileSync(new URL(`../fixtures/us-facts/${t}.json`, import.meta.url), 'utf8'));

test('monthEnd puts a 52 or 53 week period end on the nearest calendar month end', () => {
  assert.equal(monthEnd('2025-09-27'), '2025-09-30'); assert.equal(monthEnd('2025-09-30'), '2025-09-30'); assert.equal(monthEnd('2026-01-03'), '2025-12-31'); assert.equal(monthEnd('2024-03-30'), '2024-03-31'); assert.equal(monthEnd('2024-02-29'), '2024-02-29');
});
test('financial SIC groups carry the bank format, others do not', () => { assert.equal(formatOfSic(6021), 'IFBanking'); assert.equal(formatOfSic(6311), 'IFBanking'); assert.equal(formatOfSic(3571), 'IndAs'); assert.equal(formatOfSic(null), 'IndAs'); });
test('Apple: quarters on month ends, original filing dates, fourth quarter is the year less nine months', () => {
  const q = buildQuarters(load('AAPL'), 3571), by = new Map(q.map((x) => [x.period, x]));
  const fy25 = by.get('2025-09-30')!; assert.equal(fy25.fields.revenue, 102_466_000_000); assert.equal(fy25.ytd.revenue, 416_161_000_000); assert.equal(fy25.asOf.slice(0, 10), '2025-10-31');
  const q1 = by.get('2025-12-31')!; assert.equal(q1.fields.revenue, 143_756_000_000); assert.equal(q1.ytd.revenue, 143_756_000_000);
  const dates = q.map((x) => x.period); assert.deepEqual(dates, [...dates].sort()); for (const d of dates) assert.match(d, /-(03-31|06-30|09-30|12-31)$/);
  assert.ok(q.length >= 40);
});
test('Apple reports no interest expense: it is read as none, so operating EBIT is reported operating income', () => {
  const q = buildQuarters(load('AAPL'), 3571).at(-1)!; assert.equal(q.extra.q.financeCost, 0); assert.ok(q.extra.q.otherIncome != null);
  assert.equal(q.extra.q.interestAssumed, 1);
});
test('JPMorgan is a financial name; Walmart (January year end) lines up on month ends', () => {
  assert.equal(buildQuarters(load('JPM'), 6021)[0].format, 'IFBanking');
  const w = buildQuarters(load('WMT'), 5331).map((x) => x.period); assert.ok(w.includes('2026-01-31') && w.includes('2025-10-31')); for (let i = 1; i < 12; i++) assert.ok(w.includes(w[w.length - 1 - i]));
});
test('nothing is dated before it was filed: a quarter is as-of its first filing, never a later restatement', () => {
  for (const t of ['AAPL', 'MSFT', 'WMT']) for (const x of buildQuarters(load(t))) assert.ok(x.asOf.slice(0, 10) > x.period, `${t} ${x.period} filed ${x.asOf}`);
});
test('the as-of view and the figures table read US quarters unchanged: Microsoft trailing profit, shares and earnings yield', () => {
  const facts = buildQuarters(load('MSFT'), 7372).map((x) => ({ entity: 'MSFT', period: x.period, basis: x.basis, asOf: x.asOf, revision: 0, fields: x.fields, ytd: x.ytd, format: x.format, extra: x.extra }));
  const view = asOfResults(facts, 'MSFT', '2026-11-13', { limit: 40 }), f = computeFeatures(view, 500, []);
  assert.ok(f.ttm.pat! > 100e9 && f.ttm.pat! < 160e9, String(f.ttm.pat)); assert.ok(f.shares! > 7e9 && f.shares! < 8e9); assert.ok(f.earningsYield! > 0.01 && f.earningsYield! < 0.1, String(f.earningsYield));
  assert.ok(f.margin.operatingEbit! > 0.3 && f.margin.operatingEbit! < 0.6, String(f.margin.operatingEbit));
  assert.equal(f.financial, false); assert.ok(f.bs && f.bs.assets! > 5e11);
});
test('before a filing date the quarter does not exist', () => {
  const facts = buildQuarters(load('MSFT'), 7372).map((x) => ({ entity: 'MSFT', period: x.period, basis: x.basis, asOf: x.asOf, revision: 0, fields: x.fields, ytd: x.ytd, format: x.format, extra: x.extra }));
  const v = asOfResults(facts, 'MSFT', '2026-10-27', { limit: 8 }); assert.notEqual(v.quarters[0].period, '2026-09-30');
});
test('trim keeps only what the parser reads', () => { const t = trim({ cik: 1, facts: { 'us-gaap': { Revenues: { units: { USD: [] } }, Foo: { units: { USD: [] } } }, dei: {} } }); assert.ok(t.facts!['us-gaap'].Revenues && !t.facts!['us-gaap'].Foo); });
