import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCalendar } from '../src/engine/calendar.ts';
import { planUs, usTarget } from '../src/ingest/us-plan.ts';

const cal = makeCalendar(['2026-11-26']);
const base = { cal, feedDate: '2026-10-08', screenDate: '2026-10-02', breadthDate: '2026-10-09', inflight: { daily: false, screen: false, breadth: false }, state: {} };
// Fri 9 Oct 2026: 17:30 ET = 21:30 UTC (EDT)
const at = (iso: string) => Date.parse(iso);

test('before 17:30 ET the target is the previous session; after, today', () => {
  assert.equal(usTarget(at('2026-10-09T21:00:00Z'), cal).target, '2026-10-08');
  assert.equal(usTarget(at('2026-10-09T21:37:00Z'), cal).target, '2026-10-09');
});
test('starts the daily job once a close is due and the feed is behind', () => {
  const p = planUs({ ...base, nowMs: at('2026-10-09T21:37:00Z') });
  assert.deepEqual(p.dispatch.map((d) => d.workflow), ['us-nightly.yml']);
  assert.equal(p.dispatch[0].inputs.date, '2026-10-09');
  assert.equal(p.state.daily?.attempts, 1);
});
test('nothing to do when the feed is current, and no job is started while one is running', () => {
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', nowMs: at('2026-10-09T21:37:00Z') }).dispatch.length, 0);
  assert.equal(planUs({ ...base, inflight: { daily: true, screen: false, breadth: false }, nowMs: at('2026-10-09T21:37:00Z') }).dispatch.length, 0);
});
test('alerts once after 22:30 ET, and stops dispatching after the attempt cap', () => {
  const late = at('2026-10-10T02:37:00Z'); // Fri 22:37 ET
  const p1 = planUs({ ...base, feedDate: '2026-10-08', nowMs: late });
  assert.equal(p1.alerts.length, 1);
  const p2 = planUs({ ...base, feedDate: '2026-10-08', nowMs: late, state: p1.state });
  assert.equal(p2.alerts.length, 0);
  const capped = planUs({ ...base, nowMs: late, state: { daily: { target: '2026-10-09', attempts: 8 } } });
  assert.equal(capped.dispatch.length, 0);
});
test('Thanksgiving: Friday target skips the holiday', () => {
  assert.equal(usTarget(at('2026-11-27T10:00:00Z'), cal).target, '2026-11-25');
});
test('screen starts Saturday 08:30 IST when the feed has the last session and the screen is old', () => {
  const sat = at('2026-10-10T03:07:00Z'); // Sat 08:37 IST
  const ok = planUs({ ...base, feedDate: '2026-10-09', nowMs: sat });
  assert.deepEqual(ok.dispatch.map((d) => d.workflow), ['us-screen.yml']);
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', nowMs: at('2026-10-10T02:30:00Z') }).dispatch.length, 0, 'too early');
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', screenDate: '2026-10-09', nowMs: sat }).dispatch.length, 0, 'already done');
  assert.equal(planUs({ ...base, feedDate: '2026-10-08', nowMs: sat }).dispatch.map((d) => d.workflow).includes('us-screen.yml'), false, 'feed behind');
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', nowMs: at('2026-10-08T09:00:00Z') }).dispatch.map((d) => d.workflow).includes('us-screen.yml'), false, 'weekday');
});
test('screen alert after midday Saturday if still not done', () => {
  const p = planUs({ ...base, feedDate: '2026-10-09', inflight: { daily: false, screen: true, breadth: false }, nowMs: at('2026-10-10T07:07:00Z') });
  assert.equal(p.alerts.length, 1);
});

test('breadth job starts when the close is due and breadth is behind; alerts once when late', () => {
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', breadthDate: '2026-10-08', nowMs: at('2026-10-09T21:37:00Z') }).dispatch.filter((d) => d.workflow === 'us-breadth.yml').length, 0, 'not before 20:45 ET: the data is not there yet');
  const p = planUs({ ...base, feedDate: '2026-10-09', breadthDate: '2026-10-08', nowMs: at('2026-10-10T00:50:00Z') });
  assert.deepEqual(p.dispatch.map((d) => d.workflow), ['us-breadth.yml']);
  assert.equal(p.dispatch[0].inputs.date, '2026-10-09');
  const late = at('2026-10-10T02:37:00Z');
  const p1 = planUs({ ...base, feedDate: '2026-10-09', breadthDate: '2026-10-08', nowMs: late });
  assert.equal(p1.alerts.filter((a) => a.startsWith('US breadth')).length, 1);
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', breadthDate: '2026-10-08', nowMs: late, state: p1.state }).alerts.length, 0);
  assert.equal(planUs({ ...base, feedDate: '2026-10-09', breadthDate: '2026-10-09', nowMs: late }).dispatch.length, 0);
});
