import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newBook, stepBook, type Env } from '../src/engine/stock-book.ts';
import { earningsPass, bigFallSince52Low, flatVolume } from '../src/engine/sepa.ts';

const mk = (over: Partial<Env> & { D: string }, sig?: Env['signal']): Env => ({ open: () => 100, close: () => 100, cashRet: 0, tier: () => 0, signal: sig ?? (() => null), ...over });
const opened = () => { const st = newBook('t', '2020-01-01'); st.risk = 0.0125; stepBook(st, mk({ D: '2021-01-04' }, () => ({ buys: [{ sym: 'A', value: 1e9, stop: 0.05, stopPx: 95 }], sells: [] }))); return st; };

test('SEPA mode: size = risk / stop width, capped at 25%; stop is a fixed price', () => {
  const st = opened(); stepBook(st, mk({ D: '2021-01-05', bar: () => ({ o: 100, h: 101, l: 99 }) }));
  const p = st.pos.A; assert.equal(p.fixStop, 95); assert.ok(Math.abs(p.sh * 100 - 25) < 1e-9);
  const st2 = newBook('t', '2020-01-01'); st2.risk = 0.0125; stepBook(st2, mk({ D: '2021-01-04' }, () => ({ buys: [{ sym: 'A', value: 1e9, stop: 0.1, stopPx: 90 }], sells: [] }))); stepBook(st2, mk({ D: '2021-01-05' }));
  assert.ok(Math.abs(st2.pos.A.sh * 100 - 12.5) < 1e-9);   // 1.25% / 10% = 12.5%
});
test('stop caps at 10% below entry even when the base low is lower', () => {
  const st = newBook('t', '2020-01-01'); st.risk = 0.0125; stepBook(st, mk({ D: '2021-01-04' }, () => ({ buys: [{ sym: 'A', value: 1e9, stop: 0.2, stopPx: 80 }], sells: [] }))); stepBook(st, mk({ D: '2021-01-05' }));
  assert.ok(Math.abs(st.pos.A.fixStop! - 90) < 1e-9);
});
test('intraday stop sells at the stop; a gap below sells at the open', () => {
  const a = opened(); stepBook(a, mk({ D: '2021-01-05' })); stepBook(a, mk({ D: '2021-01-06', bar: () => ({ o: 100, h: 100, l: 94 }) }));
  assert.equal(a.pos.A, undefined); assert.equal(a.closed[0].exit, 95); assert.equal(a.closed[0].why, 'stop');
  const b = opened(); stepBook(b, mk({ D: '2021-01-05' })); stepBook(b, mk({ D: '2021-01-06', bar: () => ({ o: 90, h: 92, l: 88 }) }));
  assert.equal(b.closed[0].exit, 90);
});
test('half sale at twice the stop distance, stop to breakeven on the rest', () => {
  const st = opened(); stepBook(st, mk({ D: '2021-01-05' })); const sh0 = st.pos.A.sh;
  stepBook(st, mk({ D: '2021-01-06', bar: () => ({ o: 105, h: 111, l: 104 }), close: () => 109 }));
  assert.equal(st.closed.length, 1); assert.equal(st.closed[0].part, true); assert.equal(st.closed[0].exit, 110); assert.ok(Math.abs(st.pos.A.sh - sh0 / 2) < 1e-9); assert.equal(st.pos.A.fixStop, 100);
  stepBook(st, mk({ D: '2021-01-07', bar: () => ({ o: 108, h: 108, l: 99 }) })); assert.equal(st.pos.A, undefined); assert.equal(st.closed[1].exit, 100);
});
test('50-day rule: a rising 50-day average at or above entry becomes the stop', () => {
  const st = opened(); stepBook(st, mk({ D: '2021-01-05' }));
  stepBook(st, mk({ D: '2021-01-06', sma50: () => 101, close: () => 120 })); assert.equal(st.pos.A.fixStop, 95);   // first reading, not yet rising
  stepBook(st, mk({ D: '2021-01-07', sma50: () => 103, close: () => 121 })); assert.equal(st.pos.A.fixStop, 103);
});
test('too little cash: the signal is skipped and logged, not cut down', () => {
  const st = newBook('t', '2020-01-01'); st.risk = 0.0125; st.cash = 100; st.pos.B = { sh: 0.9, entry: 100, entryDate: '2020-12-01', high: 100, stop: 0.1 }; st.lastValue.B = 1e9; st.cash = 10;
  stepBook(st, mk({ D: '2021-01-04' }, () => ({ buys: [{ sym: 'A', value: 1e9, stop: 0.05, stopPx: 95 }], sells: [] }))); stepBook(st, mk({ D: '2021-01-05' }));
  assert.equal(st.pos.A, undefined); assert.equal(st.skipped.at(-1)?.why, 'no cash');
});
test('default books unchanged: no risk set means no SEPA paths', () => {
  const st = newBook('t', '2020-01-01'); stepBook(st, mk({ D: '2021-01-04' }, () => ({ buys: [{ sym: 'A', value: 1e9, stop: 0.1 }], sells: [] }))); stepBook(st, mk({ D: '2021-01-05', bar: () => ({ o: 100, h: 200, l: 1 }) }));
  assert.equal(st.pos.A.fixStop, undefined); assert.ok(Math.abs(st.pos.A.sh * 100 - 5) < 1e-9); assert.equal(st.closed.length, 0);
});
test('earnings: latest at least 25% and the two before above zero; missing is not a pass', () => {
  assert.equal(earningsPass([0.3, 0.1, 0.05]), true); assert.equal(earningsPass([0.24, 0.1, 0.05]), false); assert.equal(earningsPass([0.3, 0, 0.05]), false); assert.equal(earningsPass(null), false);
});
test('largest one-day fall since the 52-week low', () => {
  const c = Array.from({ length: 300 }, (_, i) => 100 + i * 0.1); c[200] = c[199] * 0.97; for (let i = 201; i < 300; i++) c[i] = c[200] + (i - 200) * 0.1; c[250] = c[249] * 0.95;
  assert.equal(bigFallSince52Low(c, 250), true); const d = c.slice(); d[250] = d[249] * 0.98; assert.equal(bigFallSince52Low(d, 250), false);
});
test('flat-base volume: dry-up before, 150% on the day', () => {
  const v = new Array(100).fill(100); for (let i = 89; i < 99; i++) v[i] = 60; v[99] = 160; const r = flatVolume(v, 99); assert.equal(r.dry, true); assert.equal(r.vol, true);
});
