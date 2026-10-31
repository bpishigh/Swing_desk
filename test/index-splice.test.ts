import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spliceIndex, above200 } from '../src/backtest/index-splice.ts';

test('BSE is scaled by the last known Nifty/BSE ratio, never a later one', () => {
  const dates = ['a', 'b', 'c', 'd', 'e'];
  const nifty = { c: 200, d: 220, e: 242 }, bse = { a: 100, b: 100, c: 100, d: 110, e: 121 };
  const s = spliceIndex(dates, nifty, bse);
  assert.deepEqual([...s.values], [200, 200, 200, 220, 242]);        // a, b use the first common ratio 2.0; c, d, e are Nifty
  assert.equal(s.fromBse, 2); assert.equal(s.fromNifty, 3);
});
test('a missing Nifty session after the splice uses the ratio of the session before', () => {
  const nifty = { a: 200, c: 240 }, bse = { a: 100, b: 105, c: 120 };
  const s = spliceIndex(['a', 'b', 'c'], nifty, bse);
  assert.equal(s.values[1], 210);
});
test('above200 needs 200 sessions', () => {
  const v = Array.from({ length: 250 }, (_, i) => 100 + i);
  assert.equal(above200(v, 150), false); assert.equal(above200(v, 249), true);
  v[249] = 1; assert.equal(above200(v, 249), false);
});
