import test from 'node:test';
import assert from 'node:assert/strict';
import { pivots, trendlines, chartFor } from '../src/ingest/scan-chart.ts';
test('finds a falling resistance through two lower pivot highs and a rising support through two higher lows', () => {
  const h: number[] = [], l: number[] = [];
  for (let i = 0; i < 60; i++) { const w = Math.sin(i / 3) * 5; h.push(100 + w - i * 0.1 + 1); l.push(100 + w - i * 0.1 - 1); }
  const p = pivots(h, l); assert.ok(p.hi.length >= 2 && p.lo.length >= 2);
  const t = trendlines(h, l); assert.ok(t.resistance && t.resistance.p2 < t.resistance.p1);
  const up = h.map((_, i) => 50 + i + Math.sin(i / 3) * 4 + 1), dn = up.map((x) => x - 2);
  assert.ok(trendlines(up, dn).support!.p2 > trendlines(up, dn).support!.p1);
});
test('chart data carries the averages and the setup levels', () => {
  const N = 300, c = new Float64Array(N).map((_, i) => 50 + i * 0.2), h = c.map((x) => x + 1), l = c.map((x) => x - 1);
  const hist = { dates: Array.from({ length: N }, (_, i) => `d${String(i).padStart(3, '0')}`), series: new Map([['X', { c, h, l, v: new Float64Array(N) }]]) };
  const d = chartFor(hist as any, 'X', { trigger: 111, stop: 100 })!;
  assert.equal(d.c.length, 260); assert.equal(d.trigger, 111); assert.ok(d.sma200[259] !== null); assert.ok(d.high52! > 100);
});
