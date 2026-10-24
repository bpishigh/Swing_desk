import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockTrend, fundHealth, rankHealth, type Trend } from '../src/pm/holdhealth.ts';

const mk = (n: number, f: (i: number) => number) => ({ dates: Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10)), closes: Array.from({ length: n }, (_, i) => f(i)) });
test('rising stock is above its average with a positive return', () => {
  const s = mk(250, (i) => 100 + i); const t = stockTrend(s.dates, s.closes, s.dates[249])!;
  assert.equal(t.above, true); assert.ok(t.ret > 0.4);
});
test('falling stock is below; short, stale or broken series are unreadable', () => {
  const s = mk(250, (i) => 400 - i); assert.equal(stockTrend(s.dates, s.closes, s.dates[249])!.above, false);
  const sh = mk(150, (i) => 100 + i); assert.equal(stockTrend(sh.dates, sh.closes, sh.dates[149]), null);
  assert.equal(stockTrend(s.dates, s.closes, '2027-06-01'), null);
  const b = mk(250, (i) => (i < 200 ? 100 : 40)); assert.equal(stockTrend(b.dates, b.closes, b.dates[249]), null);
});
test('fund health: coverage gate and weighted shares', () => {
  const tr = new Map<string, Trend>([['A', { above: true, ret: 0.2 }], ['B', { above: false, ret: -0.1 }]]);
  const res = (l: { name: string }) => (l.name === 'a' ? 'A' : l.name === 'b' ? 'B' : null);
  const h = fundHealth([{ name: 'a', weight: 30 }, { name: 'b', weight: 10 }, { name: 'x', weight: 20 }], res, tr)!;
  assert.ok(Math.abs(h.aboveShare - 0.75) < 1e-9); assert.ok(Math.abs(h.ret6m - 0.125) < 1e-9); assert.ok(Math.abs(h.coverage - 40 / 60) < 1e-9);
  assert.equal(fundHealth([{ name: 'a', weight: 10 }, { name: 'x', weight: 30 }], res, tr), null);
});
test('ranking is inside the category and needs enough peers', () => {
  const f = (code: string, cat: string, a: number, r: number) => ({ code, cat, aboveShare: a, ret6m: r, coverage: 1, readable: 10, lines: 10 });
  const big = Array.from({ length: 8 }, (_, i) => f('c' + i, 'X', i / 10, i / 20)), r = rankHealth([...big, f('s1', 'Y', 0.9, 0.5), f('s2', 'Y', 0.1, 0.1)]);
  assert.equal(r.find((x) => x.code === 'c7')!.band, 'Strong'); assert.equal(r.find((x) => x.code === 'c0')!.band, 'Weak'); assert.equal(r.find((x) => x.code === 's1')!.pct, null);
});
