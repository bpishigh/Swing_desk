import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insiderBuy, INS } from '../src/engine/insider.ts';
import { runUp, reactionIndex, RUN } from '../src/engine/runup.ts';
import { newBook } from '../src/engine/stock-book.ts';

const N = 80, dates = Array.from({ length: N }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10));
const ser = (c: number[]) => ({ c, h: c.map((x) => x * 1.005), l: c.map((x) => x * 0.995), v: c.map(() => 1000) });
const flat = (v: number) => Array.from({ length: N }, () => v);

test('insider: a qualifying filing on the signal day is bought; below the floor, already held and non-top-500 are not', () => {
  const t = N - 1, D = dates[t], base = { accn: 'a', filed: D, ceoCfo: true, lagDays: 1, distinct30: 1 };
  const x = { el: [{ sym: 'A', value: 9 }, { sym: 'B', value: 8 }, { sym: 'C', value: 7 }], series: new Map([['A', ser(flat(100))], ['B', ser(flat(100))], ['C', ser(flat(100))]]), t, dates, held: new Set(['B']), st: newBook('x', '2026-01-01'),
    events: [{ ...base, sym: 'A', signalDate: D, value: INS.floor }, { ...base, sym: 'B', signalDate: D, value: 1e6 }, { ...base, sym: 'C', signalDate: D, value: INS.floor - 1 }, { ...base, sym: 'Z', signalDate: D, value: 1e6 }, { ...base, sym: 'A', signalDate: dates[t - 1], value: 1e6 }] };
  const log: any[] = [], o = insiderBuy(x, undefined, log);
  assert.deepEqual(o?.buys.map((b) => b.sym), ['A']);
  assert.equal(log.find((r) => r.sym === 'B')?.why, 'already held');
});
test('insider: sells after 60 sessions', () => {
  const t = N - 1, st = newBook('x', '2026-01-01'); st.pos.A = { entry: 100, entryDate: dates[t - INS.hold + 1] } as any;
  const o = insiderBuy({ el: [{ sym: 'A', value: 9 }], series: new Map([['A', ser(flat(100))]]), t, dates, held: new Set(['A']), st, events: [] });
  assert.deepEqual(o?.sells, ['A']);
});
test('run-up: after-close release reacts the next session; before-close the same session', () => {
  assert.equal(reactionIndex(dates, { sym: 'A', filed: dates[10], etDate: dates[10], etMin: 17 * 60 }), 11);
  assert.equal(reactionIndex(dates, { sym: 'A', filed: dates[10], etDate: dates[10], etMin: 8 * 60 }), 10);
});
test('run-up: needs both the run-up cut and the 2% reaction over SPY; a second release within 45 days is skipped', () => {
  const t = N - 1, c = flat(100); for (let i = t - 21; i < t; i++) c[i] = 100 * (1 + 0.05 * (i - (t - 21)) / 20); c[t] = c[t - 1] * 1.04;   // about +5% run-up, +4% reaction
  const spy = flat(100), ev = { sym: 'A', filed: dates[t], etDate: dates[t], etMin: 8 * 60 };
  const mk = (series: number[], allFiled: string[]) => ({ el: [{ sym: 'A', value: 9 }], series: new Map([['A', ser(series)]]), t, dates, held: new Set<string>(), st: newBook('x', '2026-01-01'), events: [ev], allFiled: () => allFiled, bench: (d: string) => spy[dates.indexOf(d)] ?? null });
  assert.deepEqual(runUp(mk(c, []))?.buys.map((b) => b.sym), ['A']);
  const weak = c.slice(); weak[t] = weak[t - 1] * 1.01; assert.equal(runUp(mk(weak, [])), null);
  const log: any[] = []; assert.equal(runUp({ ...mk(c, [dates[t - 20]]) }, undefined, log), null); assert.equal(log[0].why, 'second release in the quarter');
  assert.ok(RUN.cut > 0);
});

import { ipoBase, IPOB } from '../src/engine/ipo-base.ts';
test('ipo base: fires on a 2x-volume breakout above a tight base, not in a red market, not before 30 sessions', () => {
  const t = N - 1, c = flat(100), h = c.map((x) => x * 1.01), l = c.map((x) => x * 0.99), v = flat(1e6);
  for (let i = 0; i < 40; i++) { c[i] = 60 + i * 0.5; h[i] = c[i] * 1.01; l[i] = c[i] * 0.99; } for (let i = 40; i < t; i++) { c[i] = 100; h[i] = 100.5; l[i] = 99.5; }   // run up, then a tight 15+ session base with high 100.5
  c[t] = 102; h[t] = 102; l[t] = 100; v[t] = 3e6;
  const s = { c, h, l, v }, mk = (light: string, listed: string) => ({ series: new Map([['X', s]]), t, dates, held: new Set<string>(), st: newBook('x', '2026-01-01'), ipo: [{ sym: 'X', listed }], light });
  assert.deepEqual(ipoBase(mk('green', dates[0]))?.buys.map((b) => b.sym), ['X']);
  assert.equal(ipoBase(mk('red', dates[0])), null);
  assert.equal(ipoBase(mk('green', dates[t - 10])), null);
  assert.ok(IPOB.hold === 60);
});

import { growthCombo, GC } from '../src/engine/growth-combo.ts';
test('growthCombo buys only at month end, and not when the light is red', () => {
  const N = 300, dates = Array.from({ length: N }, (_, i) => `d${i}`), series = new Map(), mk = (price: number, grow: number) => { const c = new Float64Array(N), v = new Float64Array(N); for (let i = 0; i < N; i++) { c[i] = price * (i > N - 130 ? 1 + grow * ((i - (N - 130)) / 130) : 1); v[i] = (i > 250 ? 3e6 : 1e6) * 1; } return { c, h: c, l: c, v }; };
  for (let k = 0; k < 200; k++) series.set('S' + k, mk(50 + k * 5, k % 7 === 0 ? 0.0 : 0.05 + (k % 50) * 0.01));
  series.set('WIN', mk(5, 2.0));   // cheapest price, huge 6-month gain, volume tripled
  const base = { series, t: N - 1, dates, held: new Set<string>(), st: {} as never, eligible: () => true };
  assert.deepEqual(growthCombo({ ...base, light: 'green', monthEnd: true })?.buys.map((b) => b.sym), ['WIN']);
  assert.equal(growthCombo({ ...base, light: 'green', monthEnd: false }), null);
  assert.equal(growthCombo({ ...base, light: 'red', monthEnd: true }), null);
  assert.equal(GC.trail, 0.35);
});
