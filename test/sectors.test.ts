import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankSectors, sectorStatus, type SectorSnapshot } from '../src/engine/sectors.ts';

// Engine Rules: Sector ranking. Gate: 3M beats benchmark, 3M above zero (C-58), and above 50 SMA (Red: the two 3M tests only). Score = 2 x 3M + 1M.
test('gate and score', () => {
  const rows = rankSectors([
    { name: 'A', m1: 1, m3: 10, above50: true },
    { name: 'B', m1: 5, m3: 4, above50: true },     // 3M below benchmark 5 -> fails
    { name: 'C', m1: 0, m3: 8, above50: false },    // below 50 SMA -> fails in normal mode
  ], 5, 'normal');
  assert.deepEqual(rows.map((r) => [r.pass, r.score, r.rank]), [[true, 21, 1], [false, null, null], [false, null, null]]);
});

test('C-58: a sector falling less than a falling benchmark does not pass', () => {
  const rows = rankSectors([{ name: 'F', m1: 1, m3: -0.8, above50: true }, { name: 'G', m1: 2, m3: 5, above50: true }], -3.85, 'normal');
  assert.deepEqual(rows.map((r) => [r.pass, r.rank]), [[false, null], [true, 1]]);
  assert.equal(rankSectors([{ name: 'F', m1: 1, m3: -0.8, above50: false }], -3.85, 'red')[0].pass, false);
});

test('red mode drops the 50 SMA test only', () => {
  const rows = rankSectors([{ name: 'C', m1: 0, m3: 8, above50: false }, { name: 'D', m1: 2, m3: 3, above50: true }], 5, 'red');
  assert.deepEqual(rows.map((r) => [r.pass, r.rank]), [[true, 1], [false, null]]);
});

test('missing 1M still scores 2 x 3M; missing benchmark passes nothing', () => {
  assert.equal(rankSectors([{ name: 'A', m3: 9, above50: true }], 5, 'normal')[0].score, 18);
  assert.equal(rankSectors([{ name: 'A', m1: 1, m3: 9, above50: true }], undefined, 'normal')[0].pass, false);
});

// Replay: recompute the saved week from its own inputs; v9 stored its outputs in the same document.
test('replay vs the saved v9 week 2026-09-29, with the C-58 zero test applied to the saved outputs', () => {
  const doc = JSON.parse(readFileSync('fixtures/db/sectors/2026-09-29.json', 'utf8'));
  const got = rankSectors(doc.rows, doc.nifty.m3, doc.mode);
  const keep = doc.rows.filter((r: any) => r.pass && r.m3 > 0).sort((a: any, b: any) => b.score - a.score).map((r: any) => r.name);   // v9 passed sectors with a negative 3M (Auto, Oil & Gas); C-58 does not
  doc.rows.forEach((saved: any, i: number) => {
    const exp = keep.indexOf(saved.name);
    assert.equal(got[i].name, saved.name);
    assert.equal(got[i].pass, exp >= 0, saved.name + ' pass');
    assert.equal(got[i].score, exp >= 0 ? saved.score : null, saved.name + ' score');
    assert.equal(got[i].rank, exp >= 0 ? exp + 1 : null, saved.name + ' rank');
  });
});


// Engine Rules: persistence over two consecutive weekends; new leader = jumps from outside the top 8 into the top 4 within 3 weeks.
const snap = (id: string, ranks: Record<string, number | null>): SectorSnapshot => ({ id, rows: Object.entries(ranks).map(([name, rank]) => ({ name, rank })) });
test('persistence needs the top 4 in two consecutive weeks', () => {
  assert.equal(sectorStatus([snap('w1', { X: 2 }), snap('w2', { X: 3 })], 'X')!.persist, true);
  assert.equal(sectorStatus([snap('w1', { X: 6 }), snap('w2', { X: 3 })], 'X')!.persist, false);
});
test('new leader: top 4 now, not before, and outside the top 8 (or absent) in the previous 3 weeks', () => {
  assert.equal(sectorStatus([snap('w1', { X: 12 }), snap('w2', { X: 7 }), snap('w3', { X: 5 }), snap('w4', { X: 2 })], 'X')!.newLeader, true);
  assert.equal(sectorStatus([snap('w1', { X: 6 }), snap('w2', { X: 6 }), snap('w3', { X: 5 }), snap('w4', { X: 2 })], 'X')!.newLeader, false);
  assert.equal(sectorStatus([snap('w1', { X: 3 }), snap('w2', { X: 2 })], 'X')!.newLeader, false); // persisted, not new
});
