import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMinutes, projectMonth, dueAlert } from '../src/ops/usage.ts';

test('each run counts as whole minutes, at least one', () => {
  const r = estimateMinutes([
    { name: 'tick', startedAt: '2026-10-12T13:37:00Z', endedAt: '2026-10-12T13:37:14Z' },
    { name: 'tick', startedAt: '2026-10-12T14:07:00Z', endedAt: '2026-10-12T14:08:01Z' },
    { name: 'india-stocks', startedAt: '2026-10-12T13:40:00Z', endedAt: '2026-10-12T13:46:30Z' },
  ]);
  assert.deepEqual(r.byWorkflow, { tick: 3, 'india-stocks': 7 }); assert.equal(r.total, 10);
});
test('projection is straight-line', () => assert.equal(projectMonth(300, 10, 31), 930));
test('one alert for the highest newly crossed threshold, none repeated', () => {
  assert.equal(dueAlert(1000, []), null);
  assert.equal(dueAlert(1300, []), 60);
  assert.equal(dueAlert(1700, []), 80);
  assert.equal(dueAlert(1700, [60]), 80);
  assert.equal(dueAlert(1700, [60, 80]), null);
  assert.equal(dueAlert(1950, [60, 80]), 95);
});
