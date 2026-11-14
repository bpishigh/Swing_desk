import test from 'node:test';
import assert from 'node:assert/strict';
import { overlapOf } from '../src/engine/overlap.ts';
const L = (s: string) => s.split('');
test('overlap: names in most books first, pair counts and rank correlation', () => {
  const r = overlapOf([{ id: 'a', short: 'A', label: 'a', list: L('ABCDEFGHIJKLMNOPQRSTUVWXYZ') }, { id: 'b', short: 'B', label: 'b', list: L('ZYXWVUTSRQPONMLKJIHGFEDCBA') }, { id: 'c', short: 'C', label: 'c', list: L('ABCDEFGHIJKLMNOPQRSTUVWXYZ') }], () => null);
  assert.equal(r.pairs['A|C'], 20); assert.equal(r.corr['A|C'], 1); assert.equal(r.corr['A|B'], -1);
  assert.equal(r.pairs['A|B'], 14);   // A holds A..T, B holds Z..G: G..T = 14 names
  assert.deepEqual(r.names.slice(0, 3).map((x) => x.sym), ['G', 'H', 'I']); assert.equal(r.names[0].count, 3);
});
test('overlap: correlation is not reported on fewer than 10 common names', () => {
  const r = overlapOf([{ id: 'a', short: 'A', label: 'a', list: L('ABCDE') }, { id: 'b', short: 'B', label: 'b', list: L('EDCBA') }], () => null);
  assert.equal(r.corr['A|B'], null); assert.equal(r.pairs['A|B'], 5);
});
