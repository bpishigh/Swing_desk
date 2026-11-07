import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSleeve, MOM30 } from '../src/engine/momentum-sleeve.ts';
import { resultsAvoid } from '../src/ingest/earnings.ts';

// 40 names, trending at different speeds so the ranking is the speed order: S0 fastest.
const N = 400, series = new Map<string, { c: Float64Array }>(), el: Array<{ sym: string; value: number }> = [];
for (let k = 0; k < 40; k++) { const c = new Float64Array(N); for (let i = 0; i < N; i++) c[i] = 100 * Math.exp(((40 - k) / 40) * 0.002 * i + 0.003 * Math.sin(i * (k + 1))); series.set('S' + k, { c }); el.push({ sym: 'S' + k, value: 1e9 - k }); }
const t = N - 1;
test('a name with results close is not newly bought; the next-ranked name takes its place', () => {
  const base = selectSleeve(el, series, t, new Set()), top = base.picks[0].sym;
  const r = selectSleeve(el, series, t, new Set(), new Set([top]));
  assert.equal(base.picks.length, MOM30.HOLD); assert.equal(r.picks.length, MOM30.HOLD);
  assert.ok(base.picks.some((p) => p.sym === top)); assert.ok(!r.picks.some((p) => p.sym === top));
});
test('a name already held stays, results or not', () => {
  const base = selectSleeve(el, series, t, new Set()), top = base.picks[0].sym;
  const r = selectSleeve(el, series, t, new Set([top]), new Set([top]));
  assert.ok(r.picks.some((p) => p.sym === top));
});
test('resultsAvoid: within the window only, unknown dates ignored', () => {
  const gap = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
  const s = resultsAvoid({ A: '2026-11-10', B: '2026-12-30', C: undefined, D: '2026-11-01' }, '2026-11-06', gap);
  assert.deepEqual([...s], ['A']);
});
