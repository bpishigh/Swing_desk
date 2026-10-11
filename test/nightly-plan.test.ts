import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planNightly, targetSession, MAX_ATTEMPTS } from '../src/ingest/nightly-plan.ts';
import { makeCalendar } from '../src/engine/calendar.ts';

const cal = makeCalendar(['2026-10-20']);   // pretend Tue 20 Oct is a holiday
const ist = (iso: string, hhmm: string) => Date.parse(`${iso}T${hhmm}:00+05:30`);
const none = { nightly: false, stocks: false };
const base = { cal, inflight: none, state: {} };

test('target: today from 19:00 IST on a session day, otherwise the previous session', () => {
  assert.equal(targetSession(ist('2026-10-12', '18:59'), cal).target, '2026-10-09');   // Monday before 19:00 -> Friday
  assert.equal(targetSession(ist('2026-10-12', '19:07'), cal).target, '2026-10-12');
  assert.equal(targetSession(ist('2026-10-10', '12:00'), cal).target, '2026-10-09');   // Saturday
  assert.equal(targetSession(ist('2026-10-20', '21:00'), cal).target, '2026-10-19');   // holiday
});
test('nothing to do when both data sets have reached the target', () => {
  const p = planNightly({ ...base, nowMs: ist('2026-10-12', '19:37'), feedDate: '2026-10-12', stocksDate: '2026-10-12' });
  assert.deepEqual(p.dispatch, []); assert.equal(p.alert, null);
});
test('both jobs started with the target date; stock job asked to fill missed sessions', () => {
  const p = planNightly({ ...base, nowMs: ist('2026-10-13', '19:07'), feedDate: '2026-10-09', stocksDate: '2026-10-09' });   // Monday 12th was missed
  assert.deepEqual(p.dispatch.map((d) => d.workflow), ['india-nightly.yml', 'india-stocks.yml']);
  assert.equal(p.dispatch[0].inputs.date, '2026-10-13');
  assert.equal(p.dispatch[1].inputs.backfill, '1');
});
test('a job already running is not started again; only the other one is', () => {
  const p = planNightly({ ...base, nowMs: ist('2026-10-12', '19:37'), feedDate: '2026-10-09', stocksDate: '2026-10-09', inflight: { nightly: true, stocks: false } });
  assert.deepEqual(p.dispatch.map((d) => d.workflow), ['india-stocks.yml']);
});
test('only the job that is behind is started', () => {
  const p = planNightly({ ...base, nowMs: ist('2026-10-12', '20:07'), feedDate: '2026-10-12', stocksDate: '2026-10-09' });
  assert.deepEqual(p.dispatch.map((d) => d.workflow), ['india-stocks.yml']);
});
test('alert once after 22:30 IST when still behind', () => {
  const a = planNightly({ ...base, nowMs: ist('2026-10-12', '22:37'), feedDate: '2026-10-12', stocksDate: '2026-10-09' });
  assert.match(a.alert!, /2026-10-12 is not written yet at 22:37 IST/);
  const b = planNightly({ ...base, nowMs: ist('2026-10-12', '23:07'), feedDate: '2026-10-12', stocksDate: '2026-10-09', state: a.state });
  assert.equal(b.alert, null);
  const early = planNightly({ ...base, nowMs: ist('2026-10-12', '21:07'), feedDate: '2026-10-12', stocksDate: '2026-10-09' });
  assert.equal(early.alert, null);
});
test('retries stop after the cap and say so', () => {
  const state = { target: '2026-10-12', attempts: { nightly: 0, stocks: MAX_ATTEMPTS }, alertedFor: undefined };
  const p = planNightly({ ...base, nowMs: ist('2026-10-12', '21:07'), feedDate: '2026-10-12', stocksDate: '2026-10-09', state });
  assert.deepEqual(p.dispatch, []); assert.match(p.alert!, /retries used up/);
});
test('state resets on a new target day', () => {
  const p = planNightly({ ...base, nowMs: ist('2026-10-13', '19:07'), feedDate: '2026-10-12', stocksDate: '2026-10-12', state: { target: '2026-10-12', attempts: { nightly: 5, stocks: 5 }, alertedFor: '2026-10-12' } });
  assert.equal(p.state.target, '2026-10-13'); assert.equal(p.state.attempts.nightly, 1);
});
