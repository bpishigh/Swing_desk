import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryRatio, expiryDays } from '../src/engine/batch-c.ts';
const mk = (n: number, f: (i: number) => number, eq = (_i: number) => 1) => ({ p: Float64Array.from({ length: n }, (_, i) => f(i)), eq: Uint8Array.from({ length: n }, (_, i) => eq(i)) });
test('ratio: tonight over the prior 20-session mean', () => { const d = mk(30, (i) => (i === 25 ? 60 : 30)); assert.equal(deliveryRatio(d, 25), 2); });
test('ratio: a trade-for-trade day in the window voids it, and so does thin coverage', () => {
  assert.equal(deliveryRatio(mk(30, () => 40, (i) => (i === 10 ? 0 : 1)), 25), null);
  assert.equal(deliveryRatio(mk(30, (i) => (i < 22 ? NaN : 40)), 25), null);
});
test('ratio: needs a full history and tonight in the normal series', () => { assert.equal(deliveryRatio(mk(30, () => 40), 10), null); assert.equal(deliveryRatio(mk(30, () => 40, (i) => (i === 25 ? 0 : 1)), 25), null); });
test('expiry: last Thursday before Sep 2025, last Tuesday after, prior session on a holiday', () => {
  const wk = (a: string, b: string): string[] => { const o: string[] = []; for (let d = new Date(a + 'T00:00:00Z'); d <= new Date(b + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) o.push(d.toISOString().slice(0, 10)); return o; };
  const e = expiryDays(wk('2025-01-01', '2025-12-31')); assert.ok(e.has('2025-01-30') && e.has('2025-10-28') && e.has('2025-09-30'));
  const h = wk('2025-01-01', '2025-01-31').filter((d) => d !== '2025-01-30'); assert.ok(expiryDays(h).has('2025-01-29'));
});
