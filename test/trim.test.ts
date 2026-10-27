import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimTiers, ret63Back } from '../src/pm/trim.ts';

// 15 stocks, 100 sessions; stock i grows at i basis points a day, so rank is stable: S14 strongest, S0 weakest.
const dates = Array.from({ length: 100 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
const px: Record<string, number[]> = {};
for (let k = 0; k < 15; k++) px['S' + k] = dates.map((_, i) => 100 * Math.pow(1 + k / 1000, i));
const cands = Object.keys(px).map((symbol) => ({ symbol, weight: 1 }));

test('the weakest names beyond ten are trimmed, two at a time', () => {
  const r = trimTiers(cands, { dates, px }, []);
  const by = Object.fromEntries(r.map((x) => [x.symbol, x.tier]));
  assert.equal(by.S14, 'keep'); assert.equal(by.S5, 'keep');
  assert.equal(by.S0, 'trim'); assert.equal(by.S1, 'trim');
  assert.equal(by.S2, 'trim-queued'); assert.equal(by.S4, 'trim-queued');
});

test('ten or fewer names: everyone stays', () => {
  const r = trimTiers(cands.slice(5), { dates, px }, []);
  assert.ok(r.every((x) => x.tier === 'keep'));
});

test('a name that crossed the line only this week is unsettled, not trimmed', () => {
  const p = { ...px }; p.S5 = dates.map((_, i) => (i < 95 ? 100 * Math.pow(1.02, i) : 100 * Math.pow(1.02, 94) * Math.pow(0.5, i - 94)));   // strong until 5 sessions ago, then falls
  const r = trimTiers(cands, { dates, px: p }, []);
  assert.equal(r.find((x) => x.symbol === 'S5')!.tier, 'unsettled');
});

test('ret63Back needs enough history', () => { assert.equal(ret63Back([1, 2, 3], 0), null); });
