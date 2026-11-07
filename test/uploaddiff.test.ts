import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadChange, ageDays } from '../src/pm/uploaddiff.ts';
import type { Trade } from '../src/pm/reader.ts';

const T = (id: string, sym: string, side: 'buy' | 'sell', qty: number, date: string): Trade => ({ instrument: sym, symbol: sym, isin: 'IN' + sym, side, qty, price: 100, value: 100 * qty, date, time: '10:00:00', exchange: 'NSE', orderId: 'o' + id, tradeId: id, kind: 'stock' });
test('only trades not seen before count; re-uploading the same file changes nothing', () => {
  const before = [T('1', 'AAA', 'buy', 10, '2026-10-01')];
  const same = uploadChange(before, before, 'x'); assert.equal(same.added, 0); assert.deepEqual(same.opened, []);
});
test('a new buy opens a holding, a full sale closes one, dates and counts are right', () => {
  const before = [T('1', 'AAA', 'buy', 10, '2026-10-01'), T('2', 'BBB', 'buy', 5, '2026-10-02')];
  const after = [...before, T('3', 'CCC', 'buy', 4, '2026-11-03'), T('4', 'BBB', 'sell', 5, '2026-11-04'), T('5', 'AAA', 'buy', 2, '2026-11-05')];
  const c = uploadChange(before, after, '2026-11-06T00:00:00Z');
  assert.equal(c.added, 3); assert.equal(c.buys, 2); assert.equal(c.sells, 1);
  assert.deepEqual(c.opened, ['CCC']); assert.deepEqual(c.closed, ['BBB']);
  assert.equal(c.firstDate, '2026-11-03'); assert.equal(c.lastDate, '2026-11-05'); assert.deepEqual(c.names, ['AAA', 'BBB', 'CCC']);
});
test('ageDays', () => { assert.equal(ageDays('2026-11-05T00:00:00Z', Date.parse('2026-11-07T12:00:00Z')), 2); assert.equal(ageDays('', 0), null); });
