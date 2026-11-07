import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBreadth, isWeakSector, WEAK_BREADTH } from '../src/engine/sector-breadth.ts';

const mk = (g: string, up: number, down: number, none = 0) => [...Array(up).fill({ group: g, above: true }), ...Array(down).fill({ group: g, above: false }), ...Array(none).fill({ group: g, above: null })];
test('share above the 50-day, stocks without an average ignored', () => {
  const m = groupBreadth([...mk('A', 6, 4, 5), ...mk('B', 2, 8)]);
  assert.deepEqual(m.get('A'), { pct: 60, n: 10 });
  assert.equal(m.get('B')!.pct, 20);
});
test('groups under 8 stocks and unassigned stocks are left out', () => {
  const m = groupBreadth([...mk('S', 5, 2), { group: null, above: true }]);
  assert.equal(m.size, 0);
});
test('weak means under 40, missing is never weak', () => {
  assert.equal(isWeakSector({ pct: WEAK_BREADTH - 0.1, n: 10 }), true);
  assert.equal(isWeakSector({ pct: WEAK_BREADTH, n: 10 }), false);
  assert.equal(isWeakSector(null), false);
});
