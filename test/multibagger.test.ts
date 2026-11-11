import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, nearHigh, maxDaily, bandOf, lift, baseRate, rng, MB, type Row } from '../src/backtest/multibagger.ts';

test('forward: peak over the start close, stops at the last close, flags a one-day doubling', () => {
  assert.equal(forward([100, 150, 320, 200], 0, 3)!.peak, 3.2);
  const f = forward([100, 110, NaN, NaN, NaN], 0, 4)!; assert.equal(f.last, 1.1); assert.equal(f.n, 1);
  assert.equal(forward([100, 101, 210, 211], 0, 3)!.jumped, true); assert.equal(forward([100, 101, 102], 0, 2)!.jumped, false);
  assert.equal(forward([NaN, 100], 0, 1), null);
});
test('nearHigh, maxDaily and bands', () => {
  const c = Array.from({ length: 260 }, (_, i) => 100 + i); c[259] = 340; assert.ok(Math.abs(nearHigh(c, 259)! - 340 / 358) < 1e-9); assert.equal(nearHigh(c, 100), null);
  assert.ok(Math.abs(maxDaily([100, 110, 99, 120], 3, 21) - (120 / 99 - 1)) < 1e-9);
  assert.deepEqual([5, 50, 199, 200, 5000].map((x) => bandOf(x, MB.priceEdges)), [0, 1, 1, 2, 3]);
});
const mk = (n: number, y: number, hit: (i: number) => boolean, feat: (i: number) => boolean): Row[] => Array.from({ length: n }, (_, i) => ({ sym: 's' + y + '_' + (i % 50), y, m: `${y}-01`, hit3: hit(i), hit5: hit(i), price: 100, dv: 1e8, near: feat(i), priceBand: 1, liqBand: 2 }));
test('lift: a feature that doubles the hit rate has lift near 2 and passes its years; a null feature does not', () => {
  const rows = [2011, 2012, 2013, 2014, 2015].flatMap((y) => mk(2000, y, (i) => (i % 2 === 0 ? i % 20 === 0 : i % 200 === 1), (i) => i % 2 === 0));
  const r = lift(rows, (x) => x.near, rng(1)); assert.ok(r.lift > 1.7 && r.lift < 2.1); assert.ok(r.lo > 1); assert.equal(r.passYears, 5); assert.equal(r.share, 1);
  const rows2 = [2011, 2012, 2013, 2014, 2015].flatMap((y) => mk(2000, y, (i) => i % 10 === 0, (i) => i % 4 < 2));
  const r2 = lift(rows2, (x) => x.near, rng(1)); assert.ok(Math.abs(r2.lift - 1) < 0.01); assert.ok(r2.share < 0.6);
  const b = baseRate(rows2, 'hit5', rng(2), 500); assert.ok(Math.abs(b.rate - 0.1) < 1e-9 && b.lo <= b.rate && b.hi >= b.rate);
});
