import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ntCalc, type NtInput } from '../src/engine/sizing.ts';
import { ntChecks, type CheckInput, type Tri } from '../src/engine/checklist.ts';
import { LIMITS, LIMITS_V9 } from '../src/engine/setups.ts';
import { weekdaysBetween } from '../src/engine/format.ts';

const base = (): CheckInput => ({
  market: 'india', setup: '1', limits: { name: 'green', ...LIMITS.india.green }, capital: 1_000_000,
  nt: ntCalc({ setup: '1', basis: 100, chartStop: 95, atr: 2, close: 99, resistance: 120, capital: 1_000_000, light: 'green', riskBase: 0.5, sector: { persist: true, newLeader: false, above200: true } }),
  sector: 'Nifty IT', sectorStatus: { rank: 1, persist: true, newLeader: false, above200: true }, industry: '',
  bottomUp: '', rs: 'yes', above50: 'yes', chartLevel: 'yes', band: 'no', lowerCircuit: 'no', resultsInWeekdays: 20,
  openCount: 2, openRiskRs: 10000, entriesToday: 0, sectorCount: 1, industryCount: 0,
});
const get = (items: { s: string; t: string }[], starts: string) => items.find((x) => x.t.startsWith(starts));

// Engine Rules: checklist rules. Each line below asserts one rule.
test('clean setup passes every line', () => {
  const items = ntChecks(base());
  assert.ok(items.every((x) => x.s === 'pass'), JSON.stringify(items.filter((x) => x.s !== 'pass')));
});
test('regime: setup 3 is not allowed in the US; Yellow drops setup 2', () => {
  assert.equal(get(ntChecks({ ...base(), market: 'us', setup: '3', limits: { name: 'green', ...LIMITS.us.green } }), 'Regime')!.s, 'fail');
  assert.equal(get(ntChecks({ ...base(), setup: '2', limits: { name: 'yellow', ...LIMITS.india.yellow } }), 'Regime')!.s, 'fail');
});
test('Red path: needs RS leader above its own 50 SMA', () => {
  const red = { ...base(), limits: { name: 'red' as const, ...LIMITS.india.red } };
  assert.equal(get(ntChecks(red), 'Regime')!.s, 'pass');
  assert.equal(get(ntChecks({ ...red, rs: 'no' }), 'Regime')!.s, 'fail');
});
test('position cap, open-risk cap and two entries a day', () => {
  assert.equal(get(ntChecks({ ...base(), openCount: 10 }), 'New-trade positions')!.s, 'fail');
  assert.equal(get(ntChecks({ ...base(), openRiskRs: 50_000 }), 'Open risk')!.s, 'fail'); // cap 5% = 50,000, plus this trade's 5,000
  assert.equal(get(ntChecks({ ...base(), entriesToday: 2 }), 'New entries')!.s, 'fail');
});
test('sector rank: Yellow needs the top 2; one weekend and not new is a fail', () => {
  const y = { ...base(), limits: { name: 'yellow' as const, ...LIMITS.india.yellow }, sectorStatus: { rank: 3, persist: true, newLeader: false, above200: true } };
  assert.equal(get(ntChecks(y), 'Sector rank')!.s, 'fail');
  const once = ntChecks({ ...base(), sectorStatus: { rank: 2, persist: false, newLeader: false, above200: true } });
  assert.equal(get(once, 'Only one weekend')!.s, 'fail');
});
test('results gap: more than 10 trading days, setup 3 exempt in India, no date is n/a', () => {
  assert.equal(get(ntChecks({ ...base(), resultsInWeekdays: 10 }), 'Results in')!.s, 'fail');
  assert.equal(get(ntChecks({ ...base(), setup: '3' }), 'Results:')!.s, 'pass');
  assert.equal(get(ntChecks({ ...base(), resultsInWeekdays: null }), 'Enter the next results')!.s, 'na');
});
test('room: 2R in India, 3R in the US', () => {
  const nt = { ...base().nt, room: 2.5 };
  assert.equal(get(ntChecks({ ...base(), nt }), 'Room')!.s, 'pass');
  assert.equal(get(ntChecks({ ...base(), nt, market: 'us', limits: { name: 'green', ...LIMITS.us.green } }), 'Room')!.s, 'fail');
});
test('weekdaysBetween counts weekdays after the first date up to the second', () => {
  assert.equal(weekdaysBetween('2026-10-02', '2026-10-05'), 1); // Fri -> Mon
  assert.equal(weekdaysBetween('2026-10-05', '2026-10-05'), 0);
});

// Replay: 500 seeded cases through the original v9 ntCalc + ntChecks; every line (state and text) must match.
test('replay vs v9 ntChecks (500 cases)', () => {
  const { cases } = JSON.parse(readFileSync('fixtures/expected/checklist-v9.json', 'utf8'));
  for (const [n, c] of cases.entries()) {
    const i = c.input, market = c.market as 'india' | 'us';
    const lim = i.light ? { name: i.light, ...LIMITS_V9[market][i.light as 'green'] } : null;
    const nt = ntCalc({ setup: i.setup, basis: i.basis, chartStop: i.chartStop, atr: i.atr, close: i.close, resistance: i.resistance, capital: i.capital, light: i.light, riskBase: i.riskBase, sector: i.sector, bottomUp: i.bottomUp } as NtInput);
    const got = ntChecks({
      market, setup: i.setup, limits: lim, capital: i.capital, nt, sector: i.sectorName, sectorStatus: i.sector, industry: i.industry,
      bottomUp: i.tri.bottomUp as Tri, rs: i.tri.rs as Tri, above50: i.tri.above50 as Tri, chartLevel: i.tri.chartLevel as Tri, band: i.tri.band as Tri, lowerCircuit: i.tri.lowerCircuit as Tri,
      listedSessions: i.listed, resultsInWeekdays: i.resultsInWeekdays, openCount: i.openCount, openRiskRs: i.openRiskRs, entriesToday: i.entriesToday, sectorCount: i.sectorCount, industryCount: i.industryCount,
    });
    // one intended wording change (OQ-8): v9 said "isn't allowed in Yellow" even in Red; the engine now says Red
    const norm = got.map((x) => ({ ...x, t: x.t.replace("isn't allowed in Red", "isn't allowed in Yellow") }));
    assert.deepEqual(norm, c.expected, `case ${n}`);
  }
});
test('room: a breakout with no overhead resistance passes (rule 5); a blank level is still n/a', () => {
  const mk = (resistance?: number) => ntCalc({ setup: '1', basis: 100, chartStop: 95, atr: 2, close: 99, resistance, capital: 1_000_000, light: 'green', riskBase: 0.5, sector: { persist: true, newLeader: false, above200: true } });
  assert.equal(get(ntChecks({ ...base(), nt: mk(0) }), 'No overhead')!.s, 'pass');
  assert.equal(get(ntChecks({ ...base(), nt: mk(98) }), 'No overhead')!.s, 'pass');
  assert.equal(get(ntChecks({ ...base(), nt: mk(undefined) }), 'Enter the nearest')!.s, 'na');
});
