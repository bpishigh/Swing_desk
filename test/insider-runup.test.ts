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
