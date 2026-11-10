import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paired, relativeDrawdown, drawdown, killStatus, scorecard, type MV } from '../src/engine/scorecard.ts';
const mv = (vals: number[], start = 2026, m0 = 12): MV[] => vals.map((v, i) => { const k = m0 - 1 + i; return { m: `${start + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`, v }; });
test('paired uses the first month-end as base and aligns months', () => {
  const p = paired(mv([100, 110, 121]), mv([100, 105, 105]));
  assert.equal(p.length, 2); assert.ok(Math.abs(p[0].x - 0.05) < 1e-12); assert.ok(Math.abs(p[1].x - 0.10) < 1e-12);
  assert.equal(paired(mv([100, 110]), mv([100])).length, 0);
});
test('relative drawdown is measured against the comparator, not in absolute terms', () => {
  assert.ok(Math.abs(drawdown(mv([100, 90])) + 0.1) < 1e-12);
  assert.ok(Math.abs(relativeDrawdown(mv([100, 90]), mv([100, 90]))) < 1e-12);          // both fell 10%: no relative fall
  assert.ok(Math.abs(relativeDrawdown(mv([100, 80]), mv([100, 100])) + 0.2) < 1e-12);   // book fell 20% while comparator flat
});
test('kill line: drawdown alone is Kill, one other line is Watch, none is Continue', () => {
  assert.equal(killStatus(mv([100, 78]), mv([100, 100]), { n: 3, avg: 0.01 }).status, 'Kill');
  assert.equal(killStatus(mv([100, 101]), mv([100, 100]), { n: 40, avg: -0.001 }).status, 'Watch');
  assert.equal(killStatus(mv([100, 101]), mv([100, 100]), { n: 40, avg: 0.02 }).status, 'Continue');
  assert.equal(killStatus(mv([100, 101]), mv([100, 100]), { n: 39, avg: -0.5 }).status, 'Continue');
});
test('kill line: two lines together is Kill', () => {
  const book = mv([100, 99, 98, 97, 96, 95, 93, 92]), comp = mv([100, 101, 102, 103, 104, 105, 106, 107]);
  const k = killStatus(book, comp, { n: 40, avg: -0.01 }); assert.equal(k.lines[1].hit, true); assert.equal(k.status, 'Kill');
});
test('scorecard: confidence is 50% before 3 months and moves with excess; the book is read against its own comparator', () => {
  const comp = mv([100, 100, 100, 100, 100, 100, 100]);
  const none = scorecard(mv([100, 101]), comp.slice(0, 2), { n: 0, avg: null }, 0.002); assert.equal(none.confidence.confidence, 0.5);
  const up = scorecard(mv([100, 102, 104, 106.1, 108.2, 110.4, 112.6]), comp, { n: 5, avg: 0.02 }, 0.002), down = scorecard(mv([100, 98, 96, 94, 92, 90, 88]), comp, { n: 5, avg: -0.02 }, 0.002);
  assert.ok(up.confidence.confidence > 0.5 && down.confidence.confidence < 0.5); assert.equal(up.months, 6); assert.ok(up.sinceStart.excess! > 0.12); assert.equal(up.trend.length, 6);
});
