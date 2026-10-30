import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET_MIN, estimateMinutes, projectMonth, dueAlert } from '../src/ops/usage.ts';

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
  assert.equal(dueAlert(1000, [], 2000), null);
  assert.equal(dueAlert(1300, [], 2000), 60);
  assert.equal(dueAlert(1700, [], 2000), 80);
  assert.equal(dueAlert(1700, [60], 2000), 80);
  assert.equal(dueAlert(1700, [60, 80], 2000), null);
  assert.equal(dueAlert(1950, [60, 80], 2000), 95);
});
test('no budget means no alert, whatever the usage (public repository, owner 30 Oct 2026)', () => {
  assert.equal(BUDGET_MIN, null);
  assert.equal(dueAlert(2893, []), null);
  assert.equal(dueAlert(5000, [], null), null);
});
