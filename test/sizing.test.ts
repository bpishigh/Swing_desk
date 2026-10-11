import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ntCalc, type NtInput } from '../src/engine/sizing.ts';
import { SETUPS, LIMITS } from '../src/engine/setups.ts';

const near = (a: number | undefined, b: number, msg = '') => assert.ok(typeof a === 'number' && Math.abs(a - b) < 1e-9, `${msg} got ${a} want ${b}`);
const base: NtInput = { setup: '1', basis: 100, chartStop: 95, atr: 2, close: 99, resistance: 120, capital: 1_000_000, light: 'green', riskBase: 0.5, sector: { persist: true, newLeader: false, above200: true } };

// Engine Rules: Setups and entry calculation. Trigger = basis x (1 + trigger%), limit above the trigger.
test('setup 1: trigger, limit, stop, size, targets, room (hand-computed)', () => {
  const o = ntCalc(base);
  near(o.trigger, 100.5); near(o.limit, 100.5 * 1.01);
  assert.equal(o.floored, false); near(o.stop, 95); near(o.rps, 5.5);
  near(o.oneR, 5000); assert.equal(o.full, 909); assert.equal(o.first, 545); assert.equal(o.add, 364); // 60/40 entry
  near(o.p1, 106); near(o.p2, 111.5); near(o.room, (120 - 100.5) / 5.5);
  assert.equal(o.pilot, false); assert.equal(o.capped, false);
});

test('stop is floored to entry minus 1.5 ATR when the chart stop is closer', () => {
  const o = ntCalc({ ...base, atr: 4 }); // 5.5 < 6
  assert.equal(o.floored, true); near(o.stop, 94.5); near(o.rps, 6);
});

test('ATR above 3% of price marks the entry volatile (close-confirmed entry)', () => {
  assert.equal(ntCalc({ ...base, atr: 3.5, close: 100 }).volatile, true);
  assert.equal(ntCalc({ ...base, atr: 2.5, close: 100 }).volatile, false);
});

test('position is capped at 20% of capital', () => {
  const o = ntCalc({ ...base, chartStop: 99.9, atr: undefined });
  assert.equal(o.capped, true); assert.equal(o.full, Math.floor(200000 / 100.5));
});

// Engine Rules: pilot size 0.25% for a new leader, a bottom-up leader or an early sector (not in Red for the first and last).
test('pilot size', () => {
  const nl = ntCalc({ ...base, sector: { persist: false, newLeader: true, above200: true } });
  assert.equal(nl.pilot, true); near(nl.riskPct, 0.25);
  const early = ntCalc({ ...base, sector: { persist: true, newLeader: false, above200: false } });
  assert.equal(early.pilot, true); assert.equal(early.early, true); near(early.riskPct, 0.25);
  const bu = ntCalc({ ...base, bottomUp: true, sector: null });
  assert.equal(bu.pilot, true);
  const redNl = ntCalc({ ...base, light: 'red', riskBase: 0.25, sector: { persist: false, newLeader: true, above200: false } });
  assert.equal(redNl.pilot, false); // Red already runs at the pilot risk and the new-leader / early rules do not apply
});

test('no regime saved uses 0.25%; missing basis or stop returns nothing', () => {
  near(ntCalc({ ...base, light: null }).riskPct, 0.25);
  assert.deepEqual(ntCalc({ ...base, basis: 0 }), {});
});

test('limits tables hold the v9 values except the Red setup list (OQ-8, tested in proposals.test.ts)', () => {
  assert.equal(LIMITS.india.green.maxPos, 10); assert.equal(LIMITS.india.yellow.top, 2); assert.equal(LIMITS.us.green.cap, 2);
  assert.ok(!LIMITS.us.green.setups.includes('3')); // setup 3 not used in the US (C-25)
  assert.equal(SETUPS['3'].resultsExempt, true);
});

// Replay: 400 seeded cases run through the original v9 ntCalc.
test('replay vs v9 ntCalc (400 cases)', () => {
  const { cases } = JSON.parse(readFileSync('fixtures/expected/ntcalc-v9.json', 'utf8'));
  for (const [n, c] of cases.entries()) {
    const got: any = ntCalc(c.input);
    for (const k of new Set([...Object.keys(c.expected), ...Object.keys(got)])) {
      const e = c.expected[k]; let g = got[k];
      if (typeof g === 'number' && !Number.isFinite(g)) g = 'NaN';
      if (typeof e === 'number' && typeof g === 'number') assert.ok(Math.abs(e - g) < 1e-9 * Math.max(1, Math.abs(e)), `case ${n} ${k}: ${g} vs ${e}`);
      else assert.deepEqual(g, e, `case ${n} ${k}`);
    }
  }
});
