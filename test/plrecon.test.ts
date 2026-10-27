import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPnl, reconcilePnl } from '../src/pm/plrecon.ts';

const rows = [['P&L report', '', '', '', '', ''], ['Stock name', 'ISIN', 'Quantity', 'Sell date', 'Selling value', 'Realised P&L'],
  ['ITC', 'INE154A01025', '60', '12-09-2025', '25,000', '3,000'], ['ITC', 'INE154A01025', '40', '15-09-2025', '17,000', '-5,010.00'], ['Old', 'INE000A01010', '10', '01-02-2024', '1000', '100']];
const cg = (o: object) => ({ fy: '2025-26', name: 'ITC', isin: 'INE154A01025', type: 'listed_equity', buyDate: '2024-08-12', sellDate: '2025-09-12', qty: 100, proceeds: 42000, cost: 47000, expenses: 10, gain: -2020, term: 'long' as const, ...o });

test('reads per-lot rows and groups them per stock for one financial year', () => {
  const r = readPnl(rows)!; assert.equal(r.lines.length, 3); assert.equal(r.hasDates, true);
  const rec = reconcilePnl(r.lines, [cg({})], '2025-26');
  assert.equal(rec.verified, true);   // sale 42,000 and profit -2,010 (= -2,020 + 10 charges added back)
  assert.equal(rec.rows.length, 1);   // the 2024 sale belongs to another year
});
test('a wrong cost shows as a profit difference with a reason', () => {
  const r = readPnl(rows)!; const rec = reconcilePnl(r.lines, [cg({ gain: -9000 })], '2025-26');
  assert.equal(rec.differ, 1); assert.match(rec.rows[0].why, /cost in the tradebook/);
});
test('a sale only one side knows is listed', () => {
  const rec = reconcilePnl(readPnl(rows)!.lines, [cg({}), cg({ name: 'SBIN', isin: 'INE062A01020' })], '2025-26');
  assert.equal(rec.onlyLedger, 1);
});
