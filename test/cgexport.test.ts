import { test } from 'node:test'; import assert from 'node:assert/strict';
import { sectionOf, scheduleCg, cgRows, type CgRow } from '../src/pm/cgexport.ts';
import rules from '../data/rules/tax.json' with { type: 'json' };
const row = (o: Partial<CgRow>): CgRow => ({ fy: '2025-26', name: 'X', isin: 'INE000A01010', type: 'listed_equity', buyDate: '2024-01-01', sellDate: '2025-08-01', qty: 10, proceeds: 1000, cost: 800, expenses: 5, gain: 195, term: 'long', ...o });
test('sections: equity short-term 111A, long-term 112A, others by their own rules', () => {
  assert.equal(sectionOf(row({ term: 'short' }), rules), '111A'); assert.equal(sectionOf(row({}), rules), '112A');
  assert.equal(sectionOf(row({ type: 'equity_fund', term: 'long' }), rules), '112A');
  assert.equal(sectionOf(row({ type: 'gold_silver_etf', term: 'short' }), rules), 'Short-term, other (slab rate)');
  assert.equal(sectionOf(row({ type: 'overseas_fof', term: 'long' }), rules), 'Long-term, other (112)');
  assert.equal(sectionOf(row({ type: 'fund_unclassified', term: null }), rules), 'Not classified');
});
test('the file lists rows, totals by section and the pre-2018 grandfathering note, for one year only', () => {
  const rows = [row({}), row({ name: 'Old, Co "A"', buyDate: '2016-03-01', cost: 100, gain: 895 }), row({ fy: '2024-25', name: 'Other year' }), row({ term: 'short', name: 'Quick', gain: -50 })];
  const o = scheduleCg(rows, '2025-26', 'Bhargav', rules);
  assert.equal(o.count, 3); assert.ok(!o.csv.includes('Other year'));
  assert.ok(o.csv.includes('"Old, Co ""A"""'));
  const t112 = o.totals.find((x) => x.section === '112A')!; assert.equal(t112.rows, 2); assert.equal(Math.round(t112.gain), 1090);
  assert.equal(o.totals.find((x) => x.section === '111A')!.gain, -50);
  assert.ok(o.notes.some((n) => n.includes('before 1 Feb 2018')));
  assert.ok(o.csv.startsWith('Schedule CG working: Bhargav, FY 2025-26'));
});
test('cgRows takes the term from the type rules, deemed short-term debt funds included', () => {
  const rep = { open: [], breaks: [], applied: [], realised: [{ key: 'INF000A01010', buyDate: '2024-01-01', sellDate: '2026-02-01', qty: 5, cost: 100, proceeds: 130, gain: 30, days: 762, long: null }, { key: 'INE000A01010', buyDate: '2025-01-01', sellDate: '2026-02-01', qty: 5, cost: 100, proceeds: 130, gain: 30, days: 396, long: null }] };
  const out = cgRows(rep as any, (k) => (k.startsWith('INF') ? 'debt_fund' : 'listed_equity'), (k) => k, () => 1, rules as any);
  assert.equal(out[0].term, 'short'); assert.equal(out[1].term, 'long'); assert.equal(out[0].gain, 29); assert.equal(out[0].isin, 'INF000A01010');
});
