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
import { wideStop } from '../src/engine/batch-c.ts';
test('stop: 3 x ATR up to 15%, wider is skipped', () => { assert.ok(Math.abs((wideStop(3, 100) ?? 0) - 0.09) < 1e-9); assert.equal(wideStop(6, 100), null); assert.equal(wideStop(0, 100), null); });
import { runupBook } from '../src/engine/batch-c.ts';
import { newBook } from '../src/engine/stock-book.ts';
test('run-up book: buys tonight\'s signal events, highest run-up first, skips held and no-slot', () => {
  const n = 60, dates = Array.from({ length: n }, (_, i) => `2026-${i < 30 ? '09' : '10'}-${String(1 + (i % 30)).padStart(2, '0')}`), c = Float64Array.from({ length: n }, () => 100), v = Float64Array.from({ length: n }, () => 1e6);
  const x = { el: [], series: new Map([['AAA', { c, v }], ['BBB', { c, v }]]), t: 50, dates, held: new Set<string>(), fund: {}, st: newBook('x', '2026-01-01') } as never;
  const ev = (s: string, run: number, signal = true) => ({ s, d: '2026-10-19', entry: dates[50], px: 100, run, rea: 0.03, signal });
  const log: Array<{ sym: string; taken: boolean }> = [];
  const o = runupBook(x, [ev('AAA', 0.05), ev('BBB', 0.09), ev('CCC', 0.2, false)], log as never)!;
  assert.deepEqual(o.buys.map((b) => b.sym), ['BBB', 'AAA']); assert.equal(log.length, 2);
});
