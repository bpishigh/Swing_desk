import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSnapshot, reconcile } from '../src/pm/snapshot.ts';

const rows = [
  ['Holdings statement for ABC', '', '', ''], ['', '', '', ''],
  ['Stock Name', 'ISIN', 'Quantity', 'Closing Value'],
  ['HDFC Bank', 'INE040A01034', '100', '1,60,000.50'],
  ['Zero qty', 'INE000A01010', '0', '0'],
  ['Nippon Index Fund', 'INF204K01K15', '250.456', '9000'],
];

test('reads the header row by its column names, skips zero holdings, and keeps numbers with commas', () => {
  const s = readSnapshot(rows)!;
  assert.equal(s.headerRow, 2); assert.equal(s.lines.length, 2);
  assert.equal(s.lines[0].value, 160000.5); assert.equal(s.lines[1].qty, 250.456);
});
test('a sheet with no quantity column is not a statement', () => { assert.equal(readSnapshot([['a', 'b'], ['1', '2']]), null); });

const led = [{ name: 'HDFC Bank', isin: 'INE040A01034', qty: 100, kind: 'Stock' as const }, { name: 'Nippon Index Fund', isin: 'INF204K01K15', qty: 250.46, kind: 'Fund' as const }];
test('matching holdings verify; a few units of fund rounding is allowed', () => {
  const r = reconcile(readSnapshot(rows)!.lines, led);
  assert.equal(r.verified, true); assert.equal(r.matched, 2);
});
test('differences point at what may be missing', () => {
  const r = reconcile([{ isin: 'INE040A01034', name: 'HDFC Bank', qty: 120, value: null }, { isin: 'INE999Z01019', name: 'New Co', qty: 5, value: null }], led);
  assert.equal(r.verified, false); assert.equal(r.differ, 1); assert.equal(r.onlyStatement, 1); assert.equal(r.onlyLedger, 1);
  assert.match(r.rows.find((x) => x.status === 'differs')!.why, /20 more/);
});
