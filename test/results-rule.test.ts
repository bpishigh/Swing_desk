import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyResultsRule } from '../src/ingest/earnings.ts';

const c = (sym: string) => ({ sym, tags: ['results date not checked'] as string[] });
const e = (sessions: number | null, date: string | null = '2026-11-12') => (sessions === null ? { date: null, sessions: null, inWindow: null } : { date, sessions, inWindow: sessions <= 10 });

test('C-148: a Ready name with results inside 10 sessions moves to Watch, flagged', () => {
  const r = applyResultsRule({ ready: [c('A'), c('B')], watch: [c('W')] }, { A: e(3), B: e(25) });
  assert.deepEqual(r.scan.ready.map((x) => x.sym), ['B']); assert.deepEqual(r.scan.watch.map((x) => x.sym), ['W', 'A']);
  assert.deepEqual(r.demoted, ['A']); assert.deepEqual(r.scan.watch.at(-1)?.resultsBlock, { date: '2026-11-12', sessions: 3 });
  assert.ok(r.scan.watch.at(-1)?.tags?.includes('results in 3 sessions: wait'));
});
test('C-148: a Watch name inside the window is flagged and stays in Watch', () => {
  const r = applyResultsRule({ ready: [], watch: [c('W')] }, { W: e(0) });
  assert.deepEqual(r.blockedWatch, ['W']); assert.equal(r.scan.watch[0].resultsBlock?.sessions, 0);
});
test('C-148: an unknown results date changes nothing', () => {
  const r = applyResultsRule({ ready: [c('A')], watch: [] }, { A: e(null), Z: e(1) });
  assert.deepEqual(r.scan.ready.map((x) => x.sym), ['A']); assert.equal(r.scan.ready[0].resultsBlock, undefined); assert.deepEqual(r.scan.ready[0].tags, ['results date not checked']);
});
test('C-148: exactly 10 sessions away is inside the window, 11 is not', () => {
  const r = applyResultsRule({ ready: [c('A'), c('B')], watch: [] }, { A: e(10), B: e(11) });
  assert.deepEqual(r.demoted, ['A']);
});
