import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreEntry, HORIZONS, SCORING_VERSION } from '../src/pm/scoring.ts';

const f = (px: Record<string, number>, keep: number | null = 0.02, next: number | null = null) => ({ priceAt: (_s: string, d: string) => px[d] ?? null, benchAt: () => 1, keepReturn: () => keep, nextClose: () => next });

test('version 2 keeps the version 1 rules and adds Promote and Harvest', () => {
  assert.equal(SCORING_VERSION, 2);
  const e = { date: '2026-01-10', symbol: 'A', verdict: 'Promote', close: 100 };
  assert.equal(scoreEntry(e, 3, '2027-06-01', f({ '2026-01-10': 100, '2026-04-10': 110 })).right, true);
  assert.equal(scoreEntry(e, 3, '2027-06-01', f({ '2026-01-10': 100, '2026-04-10': 101 })).right, false);
  assert.equal(scoreEntry({ ...e, verdict: 'Trim' }, 3, '2027-06-01', f({ '2026-01-10': 100, '2026-04-10': 101 })).right, true);   // unchanged v1 rule
});
test('a Harvest is right when the tax value beats charges and the price gap, judged once', () => {
  const e = { date: '2026-01-10', symbol: 'A', verdict: 'Harvest', close: 100, value: 100000, taxValue: 3000, charges: 400 };
  const px = { '2026-01-10': 100 };
  assert.equal(scoreEntry(e, HORIZONS[0], '2027-06-01', f(px, 0, 101)).right, true);    // 3000 - 400 - 1000 = 1600
  assert.equal(scoreEntry(e, HORIZONS[0], '2027-06-01', f(px, 0, 104)).right, false);   // 3000 - 400 - 4000 < 0
  assert.equal(scoreEntry(e, HORIZONS[0], '2027-06-01', f(px, 0, 96)).right, true);     // a fall before the buy-back adds to it
  assert.equal(scoreEntry(e, HORIZONS[1], '2027-06-01', f(px, 0, 101)).status, 'manual');   // judged once, in the first column
  assert.equal(scoreEntry({ ...e, taxValue: undefined } as any, HORIZONS[0], '2027-06-01', f(px, 0, 101)).status, 'manual');   // logged before the tax value was kept
  assert.equal(scoreEntry(e, HORIZONS[0], '2027-06-01', f(px, 0, null)).status, 'pending');
});
