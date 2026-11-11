import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLike, dayMove, bigFall } from '../src/engine/gap-events.ts';

test('splitLike: a half, a third, three-for-two and reverse splits match; an ordinary big fall does not', () => {
  assert.equal(splitLike(0.5), 2); assert.equal(splitLike(0.49), 2); assert.equal(splitLike(1 / 3), 3); assert.equal(splitLike(2 / 3), 1.5); assert.equal(splitLike(2.02), 2); assert.equal(splitLike(10.1), 10);
  assert.equal(splitLike(0.55), null); assert.equal(splitLike(0.8), null); assert.equal(splitLike(1.05), null); assert.equal(splitLike(NaN), null); assert.equal(splitLike(0), null);
});
test('dayMove looks back over a missing close, and bigFall is 15% or more', () => {
  const c = [100, NaN, 50]; const m = dayMove(c, 2)!; assert.equal(m.prev, 0); assert.equal(m.ratio, 0.5); assert.equal(dayMove([NaN, NaN], 1), null);
  assert.ok(bigFall(0.85)); assert.ok(!bigFall(0.86));
});
