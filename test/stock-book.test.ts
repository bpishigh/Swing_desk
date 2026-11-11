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
test('a name with no close for five sessions is closed at its last close and its slot is freed', () => {
  const px = { d1: { A: [100, 100] }, d2: { A: [100, 100] }, d3: { A: [NaN, NaN] } } as any;
  const age = { v: 0 };
  const sig = (held: Set<string>) => (held.size ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.25 }], sells: [] });
  const step = (st: BookState, D: string) => stepBook(st, { D, open: (s) => px[D]?.[s]?.[0] ?? NaN, close: () => 100, age: () => age.v, cashRet: 0, tier, signal: sig });
  let st = newBook('t', 'd0'); st = step(step(st, 'd1'), 'd2'); assert.ok(st.pos.A);
  age.v = 5; st = step(st, 'd3'); assert.equal(st.pos.A, undefined); assert.equal(st.closed[0].why, 'gone'); assert.equal(st.closed[0].exit, 100);
});

test('a confirmed distribution is credited and taken off the trailing high before the stop is tested (C-179 item 9a)', () => {
  const px = { d1: { A: [100, 100] }, d2: { A: [100, 100] }, d3: { A: [78, 78] } } as any;
  const sig = (held: Set<string>) => (held.size ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.2 }], sells: [] });
  const run = (dist: number) => { let st = newBook('t', 'd0'); for (const d of ['d1', 'd2', 'd3']) st = stepBook(st, { D: d, open: (s) => px[d]?.[s]?.[0] ?? NaN, close: (s) => px[d]?.[s]?.[1] ?? NaN, cashRet: 0, tier, signal: sig, dist: (s) => (d === 'd3' && s === 'A' ? dist : 0) }); return st; };
  assert.equal(run(0).stopQueue.length, 1);                      // a 22% fall with no confirmed distribution trips a 20% stop
  const ok = run(10); assert.equal(ok.stopQueue.length, 0);       // 10 a share confirmed: high 90, close 78 is 13% below it
  assert.ok(Math.abs(ok.pos.A.high - 90) < 1e-9); assert.ok(ok.cash > 95 && Math.abs(ok.distCredit! - ok.pos.A.sh * 10) < 1e-9);
});
test('a blocked name is not bought, not stop-tested and not sold at the doubtful price (C-179 item 9c)', () => {
  const px = { d1: { A: [100, 100], B: [50, 50] }, d2: { A: [100, 100], B: [50, 50] }, d3: { A: [50, 50], B: [50, 50] }, d4: { A: [50, 50], B: [50, 50] } } as any;
  const sig = (held: Set<string>) => (held.has('A') ? null : { buys: [{ sym: 'A', value: 1e9, stop: 0.2 }], sells: [] });
  let st = newBook('t', 'd0'); const blockedFrom = (d: string) => d >= 'd3';
  for (const d of ['d1', 'd2', 'd3', 'd4']) st = stepBook(st, { D: d, open: (s) => px[d][s][0], close: (s) => (blockedFrom(d) && s === 'A' ? 100 : px[d][s][1]), cashRet: 0, tier, signal: sig, blocked: (s) => s === 'A' && blockedFrom(d) });
  assert.ok(st.pos.A); assert.equal(st.stopQueue.length, 0); assert.equal(st.closed.length, 0);
});
