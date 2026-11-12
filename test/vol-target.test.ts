import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newVt, stepVt, exposureFor } from '../src/engine/vol-target.ts';

const series = (n: number, f: (i: number) => number, start = '2026-01-01'): Array<{ d: string; v: number }> => { const out: Array<{ d: string; v: number }> = []; let v = 100; const d0 = Date.parse(start); for (let i = 0; i < n; i++) { v *= 1 + f(i); out.push({ d: new Date(d0 + i * 864e5).toISOString().slice(0, 10), v }); } return out; };
test('exposure is 100% with fewer than 20 returns, and target over volatility when the record is long', () => {
  assert.equal(exposureFor([0.01, -0.01]).e, 1);
  const calm = Array.from({ length: 60 }, (_, i) => (i % 2 ? 0.001 : -0.001)); assert.equal(exposureFor(calm).e, 1);   // about 2% a year: capped at 100%
  const wild = Array.from({ length: 60 }, (_, i) => (i % 2 ? 0.03 : -0.03)); const x = exposureFor(wild); assert.ok(x.e < 0.5 && x.e > 0.1); assert.ok(Math.abs(x.e * x.vol! - 0.15) < 1e-9);
});
test('the overlay follows the parent at full exposure, then scales down after a volatile spell at the next month start', () => {
  const p = series(90, (i) => (i % 2 ? 0.03 : -0.03)), st = stepVt(newVt('t', '2025-12-31'), p, () => 0, 0.0025);
  assert.equal(st.started, '2026-01-01'); assert.equal(st.reviews[0].e, 1); const feb = st.reviews.find((r) => r.d === '2026-02-01')!; assert.ok(feb.e < 1);
  assert.ok(Object.keys(st.costs).length >= 1); assert.ok(st.value > 0);
});
test('a night with no cash figure is counted and earns zero; a second call with the same data changes nothing', () => {
  const p = series(30, () => 0.001); const st = stepVt(newVt('t', '2025-12-31'), p, () => null, 0); assert.equal(st.cashDays.missing, 29);
  const v = st.value; stepVt(st, p, () => null, 0); assert.equal(st.value, v);
});

import { riskReturn } from '../src/engine/vol-target.ts';
test('riskReturn: waits for 60 daily returns; a calmer book with the same drift has the higher ratio', () => {
  const dates = Array.from({ length: 90 }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`);
  const mk = (amp: number) => { let v = 100; return dates.map((d, i) => ({ d, v: (v *= 1 + 0.001 + (i % 2 ? amp : -amp)) })); };
  assert.equal(riskReturn(mk(0.01).slice(0, 30), mk(0.02).slice(0, 30)), null);
  const r = riskReturn(mk(0.005), mk(0.02))!;
  assert.ok(r.book.ratio! > r.parent.ratio! && r.book.vol < r.parent.vol && r.book.n === 89);
});
