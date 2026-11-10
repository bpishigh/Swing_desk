import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trendTemplate, avgValue, maxDaily, lowTurnover, maxExclude, templateOnly, applyFilter, type S } from '../src/engine/sleeve-filters.ts';
const up = (n: number): number[] => Array.from({ length: n }, (_, i) => 100 + i * 0.5);
test('trendTemplate passes a steady uptrend near its high and fails a falling stock', () => {
  assert.equal(trendTemplate(up(400), 399), true);
  assert.equal(trendTemplate(up(400).reverse(), 399), false);
  assert.equal(trendTemplate(up(100), 99), null);
});
test('maxDaily is the largest one-day return in the window', () => {
  const c = up(60); c[50] = c[49] * 1.2; assert.ok(Math.abs(maxDaily(c, 59) - 0.2) < 1e-9); assert.ok(maxDaily(c, 40) < 0.01);
});
const mk = (k: number, vol: number): S => ({ c: Array.from({ length: 80 }, () => 100), v: Array.from({ length: 80 }, () => vol) });
test('lowTurnover drops the top fifth by 60-session traded value and keeps the rest in order', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ sym: 'S' + i, value: 1e9 - i })), series = new Map(list.map((n, i) => [n.sym, mk(i, 1000 * (i + 1))]));
  const out = lowTurnover(list, series, 79); assert.equal(out.length, 8); assert.ok(!out.some((n) => n.sym === 'S9' || n.sym === 'S8')); assert.deepEqual(out.map((n) => n.sym), ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
  assert.ok(Number.isNaN(avgValue({ c: [1, 2] }, 1)));
});
test('maxExclude removes the top tenth by largest one-day return', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ sym: 'S' + i, value: 1 })), series = new Map<string, S>();
  list.forEach((n, i) => { const c = up(80); c[70] = c[69] * (1 + 0.01 * (i + 1)); series.set(n.sym, { c }); });
  const out = maxExclude(list, series, 79); assert.equal(out.length, 9); assert.ok(!out.some((n) => n.sym === 'S9'));
});
test('templateOnly and applyFilter', () => {
  const list = [{ sym: 'UP', value: 1 }, { sym: 'DN', value: 1 }, { sym: 'NEW', value: 1 }], series = new Map<string, S>([['UP', { c: up(400) }], ['DN', { c: up(400).reverse() }], ['NEW', { c: up(100) }]]);
  assert.deepEqual(templateOnly(list, series, 399).map((n) => n.sym), ['UP']);
  assert.equal(applyFilter(undefined, list, series, 399).length, 3); assert.equal(applyFilter('template', list, series, 399).length, 1);
});
