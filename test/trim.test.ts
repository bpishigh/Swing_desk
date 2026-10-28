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

test('at most two names are newly marked in a month; a name already marked this month keeps its place', () => {
  // two open at a time allows S0 and S1; none marked yet, monthly cap 1 leaves S1 queued
  const one = trimTiers(cands, { dates, px }, [], [], 10, 2, new Set(), 1), by1 = Object.fromEntries(one.map((x) => [x.symbol, x.tier]));
  assert.equal(by1.S0, 'trim'); assert.equal(by1.S1, 'trim-queued');
  // S1 was already marked this month: it keeps its place ahead of the weaker S0 when only one slot is left
  const kept = trimTiers(cands, { dates, px }, [], [], 10, 2, new Set(['S1']), 2), by2 = Object.fromEntries(kept.map((x) => [x.symbol, x.tier]));
  assert.equal(by2.S1, 'trim'); assert.equal(by2.S0, 'trim');
  const full = trimTiers(cands, { dates, px }, [], [], 10, 2, new Set(['S12', 'S13']), 2), by3 = Object.fromEntries(full.map((x) => [x.symbol, x.tier]));
  assert.equal(by3.S0, 'trim-queued'); assert.match(full.find((x) => x.symbol === 'S0')!.why, /calendar month/);
});
