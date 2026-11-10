import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newBook, stepBook, shortStop, BOOK, type BookState, type Env } from '../src/engine/stock-book.ts';

const tier = () => 0.005;
const mk = (px: Record<string, Record<string, [number, number]>>, signal: Env['signal'], cashRet: number | null = 0) => (st: BookState, D: string): BookState =>
  stepBook(st, { D, open: (s) => px[D]?.[s]?.[0] ?? NaN, close: (s) => px[D]?.[s]?.[1] ?? NaN, cashRet, tier, signal });

test('shortStop: 3 x ATR is the stop, a signal wider than 8% is skipped', () => {
  assert.equal(shortStop(1, 100), 0.03);
  assert.equal(shortStop(2.67, 100), null);
  assert.equal(shortStop(NaN, 100), null);
});
test('buy filled at the next open, 5% weight, tier cost half each way', () => {
  const px = { d1: { A: [100, 100] }, d2: { A: [100, 100] } } as any;
  const step = mk(px, (held) => (held.size ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.25 }], sells: [] }));
  let st = newBook('t', 'd0'); st = step(st, 'd1'); assert.equal(st.pending?.signalDate, 'd1'); assert.equal(Object.keys(st.pos).length, 0);
  st = step(st, 'd2'); const p = st.pos.A;
  assert.ok(Math.abs(p.sh * 100 - 5 * (1 - 0.0025)) < 1e-9);
  assert.equal(st.started, 'd2'); assert.ok(Math.abs(st.cash - 95) < 1e-9);
});
test('trailing stop is queued on the close and sold at a later open', () => {
  const px = { d1: { A: [100, 100] }, d2: { A: [100, 100] }, d3: { A: [100, 70] }, d4: { A: [60, 65] } } as any;
  const step = mk(px, (held) => (held.size || held.has('A') ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.25 }], sells: [] }));
  let st = newBook('t', 'd0'); for (const d of ['d1', 'd2', 'd3']) st = step(st, d);
  assert.deepEqual(st.stopQueue, [{ sym: 'A', on: 'd3' }]); assert.ok(st.pos.A);
  st = step(st, 'd4'); assert.equal(st.pos.A, undefined); assert.equal(st.closed[0].why, 'stop'); assert.equal(st.closed[0].exit, 60); assert.equal(st.stopQueue.length, 0);
});
test('cash is credited at the fund return and a missing figure is counted, not carried', () => {
  const px = { d1: { A: [100, 100] }, d2: { A: [100, 100] }, d3: { A: [100, 100] } } as any;
  const sig = (held: Set<string>) => (held.size ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.25 }], sells: [] });
  let st = newBook('t', 'd0'); st = mk(px, sig, 0.01)(st, 'd1'); st = mk(px, sig, 0.01)(st, 'd2'); st = mk(px, sig, null)(st, 'd3');
  assert.equal(st.cashDays.credited, 1); assert.equal(st.cashDays.missing, 1); assert.ok(Math.abs(st.cash - 95 * 1.01) < 1e-9);
});
test('the slippage sensitivity line is below the registered line and never changes the book', () => {
  const px = { d1: { A: [100, 100] }, d2: { A: [100, 100] } } as any;
  let st = newBook('t', 'd0'); const step = mk(px, (h) => (h.size ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.25 }], sells: [] }));
  st = step(step(st, 'd1'), 'd2'); const x = st.daily.at(-1)!; assert.ok(x.vs < x.v); assert.ok(Math.abs(x.v - x.vs - 5 * BOOK.slipEachWay) < 1e-9);
});
test('a step for a date already done changes nothing', () => {
  const px = { d1: { A: [100, 100] } } as any; const step = mk(px, () => null); let st = newBook('t', 'd0'); st = step(st, 'd1'); const j = JSON.stringify(st); assert.equal(JSON.stringify(step(st, 'd1')), j);
});
