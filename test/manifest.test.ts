import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyManifest, register, recordResult, revealHoldout, gate, attempts, inChangeLog, abandon } from '../src/backtest/manifest.ts';

const rules = '| C-69 | 20 Oct 2026 | Backtester | text | Proposed |\n| C-70 | x | y | z | w |\n';
const snap = { sessions: 10, first: '2020-01-01', last: '2020-01-14', symbols: 3, splits: 1, hash: 'abc' };
const base = { changeLog: 'C-69', title: 't', hypothesis: 'h', script: 's.mjs', passRule: 'mean above zero after cost', data: snap, fit: ['2021-01-01', '2023-12-31'] as [string, string], holdout: ['2024-01-01', '2025-12-31'] as [string, string] };

test('change-log row lookup is exact', () => { assert.ok(inChangeLog('C-69', rules)); assert.ok(!inChangeLog('C-6', rules)); assert.ok(!inChangeLog('C-71', rules)); });

test('a run needs a change-log row, unless labelled exploration', () => {
  const m = emptyManifest();
  assert.throws(() => register(m, { ...base, changeLog: 'C-71' }, rules), /no row in the change log/);
  const x = register(m, { ...base, changeLog: 'C-71', exploration: true }, rules); assert.match(x.id, /-x$/);
});

test('attempts are counted per change-log id and ids do not repeat', () => {
  const m = emptyManifest();
  const a = register(m, base, rules), b = register(m, base, rules), c = register(m, { ...base, changeLog: 'C-70' }, rules);
  assert.deepEqual([a.id, b.id, c.id], ['C-69-r1', 'C-69-r2', 'C-70-r1']); assert.equal(attempts(m, 'C-69'), 2);
});

test('the pass rule must be written and the windows sane', () => {
  const m = emptyManifest();
  assert.throws(() => register(m, { ...base, passRule: '' }, rules), /pass rule/);
  assert.throws(() => register(m, { ...base, fit: ['2024-01-01', '2023-01-01'] }, rules), /inverted/);
  assert.throws(() => register(m, { ...base, fit: ['2021-01-01', '2024-06-01'] }, rules), /before the holdout/);
});

test('a result is recorded once; a new attempt is a new run', () => {
  const m = emptyManifest(); const e = register(m, base, rules);
  recordResult(m, e.id, 'mean +1%'); assert.equal(e.status, 'done');
  assert.throws(() => recordResult(m, e.id, 'again'), /already has a result/);
  const f = register(m, base, rules); abandon(m, f.id, 'bad data'); assert.equal(f.status, 'abandoned');
});

test('holdout rows stay hidden until one logged reveal', () => {
  const m = emptyManifest(); const e = register(m, base, rules);
  const rows = [{ d: '2022-05-01' }, { d: '2024-03-01' }, { d: '2025-01-01' }, { d: '2026-01-01' }];
  let g = gate(e, rows, (r) => r.d); assert.equal(g.fit.length, 1); assert.equal(g.holdout, null); assert.equal(g.hidden, 2); assert.equal(g.other, 1);
  assert.throws(() => revealHoldout(m, e.id, 'short'), /say why/);
  revealHoldout(m, e.id, 'fit window passed the pass rule; revealing once');
  g = gate(e, rows, (r) => r.d); assert.equal(g.holdout?.length, 2); assert.equal(g.hidden, 0);
  assert.throws(() => revealHoldout(m, e.id, 'second reveal attempt here'), /already revealed/);
});
