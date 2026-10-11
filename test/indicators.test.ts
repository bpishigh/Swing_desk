import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sma, emaSeeded, emaStep, atr, monthsBefore, returnOver } from '../src/engine/indicators.ts';

test('sma of last n', () => { assert.equal(sma([1, 2, 3, 4, 5], 3), 4); assert.ok(Number.isNaN(sma([1, 2], 3))); });

test('ema seeded with first n mean then rolled (matches the weekly US screen definition)', () => {
  const v = [1, 2, 3, 4, 5, 6];
  const e3 = emaSeeded(v, 3); // seed 2, k 0.5: 3->2.5? 2+0.5*(4-2)=3 ; 3+0.5*(5-3)=4 ; 4+0.5*(6-4)=5
  assert.equal(e3, 5);
  assert.equal(emaStep(10, 20, 9), 10 + 0.2 * 10);
});

test('atr is the simple mean of the last 14 true ranges', () => {
  const h = Array.from({ length: 15 }, () => 11), l = Array.from({ length: 15 }, () => 9), c = Array.from({ length: 15 }, () => 10);
  assert.equal(atr(h, l, c, 14), 2);
  c[13] = 7; h[14] = 11; l[14] = 9; // gap: |h - prev close| = 4 for the last bar, TR 4
  assert.ok(atr(h, l, c, 14) > 2);
  assert.ok(Number.isNaN(atr(h.slice(0, 5), l.slice(0, 5), c.slice(0, 5), 14)));
});

test('monthsBefore clamps to month end', () => {
  assert.equal(monthsBefore('2026-03-31', 1), '2026-02-28');
  assert.equal(monthsBefore('2026-10-03', 3), '2026-07-03');
});

test('returnOver uses the last close on or before the target date and needs enough history', () => {
  const closes = { '2026-07-02': 100, '2026-07-06': 110, '2026-10-03': 121 };
  assert.equal(returnOver(closes, '2026-10-03', 3), 21);       // target 2026-07-03 -> 07-02 close 100
  assert.ok(Number.isNaN(returnOver({ '2026-09-01': 100, '2026-10-03': 121 }, '2026-10-03', 3))); // history too short
});
