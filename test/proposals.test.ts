import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingRiskRs, pearson, seriesCorrelation, correlationGuard, stockCorrelationFlags, journalTier2, excursions, closeExcursions, type Bar } from '../src/engine/proposals.ts';
import { DEFAULT_SETTINGS } from '../src/engine/settings.ts';
import { LIMITS, LIMITS_V9 } from '../src/engine/setups.ts';
import { currentLimits } from '../src/engine/book.ts';
import { ntChecks, type CheckInput } from '../src/engine/checklist.ts';
import { ntCalc } from '../src/engine/sizing.ts';

const P = DEFAULT_SETTINGS.params;
const none = { halved: false, streakHalved: false, ddHalved: false, dd: 0 };

// ---- OQ-8 / C-24: Red is pilots only ----
test('OQ-8: Red accepts setups 1 and 4 only in each market, at pilot size, 2 positions, 0.5% open risk', () => {
  for (const m of ['india', 'us'] as const) {
    assert.deepEqual(LIMITS[m].red.setups, ['1', '4']);
    assert.equal(LIMITS[m].red.risk, 0.25); assert.equal(LIMITS[m].red.maxPos, 2); assert.equal(LIMITS[m].red.cap, 0.5);
  }
  for (const x of ['1ipo', '2', '3']) assert.ok(!LIMITS.india.red.setups.includes(x as never)); // IPO base, pullback and earnings gap are out of Red
  assert.ok(LIMITS_V9.india.red.setups.includes('2')); // v9 let it in: kept only for replay
});
const chk = (setup: CheckInput['setup'], rs: 'yes' | 'no' | '' = 'yes'): CheckInput => ({
  market: 'india', setup, limits: { name: 'red', ...LIMITS.india.red }, capital: 1_000_000,
  nt: ntCalc({ setup, basis: 100, chartStop: 92, atr: 2, close: 100, capital: 1_000_000, light: 'red', riskBase: 0.25 }),
  sector: 'IT', sectorStatus: { rank: 1, persist: true, newLeader: false, above200: true }, industry: '', bottomUp: '', rs, above50: 'yes', chartLevel: 'yes', band: 'no', lowerCircuit: 'no',
  resultsInWeekdays: 20, openCount: 0, openRiskRs: 0, entriesToday: 0, sectorCount: 0, industryCount: 0,
});
test('OQ-8: in Red a setup outside the list fails with the word Red; an RS-less stock still fails the Red path', () => {
  const r2 = ntChecks(chk('2'))[0]; assert.equal(r2.s, 'fail'); assert.match(r2.t, /setup 2 isn't allowed in Red/);
  assert.equal(ntChecks(chk('1'))[0].s, 'pass');
  assert.equal(ntChecks(chk('1', 'no'))[0].s, 'fail');
});

// ---- C-33 / C-34 ----
const base = { market: 'us' as const, today: '2026-10-05', freshPass: false, halving: none };
test('C-33: US open-risk cap steps down 2 / 1 / 0.5 only when switched on', () => {
  for (const [name, cap] of [['green', 2], ['yellow', 1], ['red', 0.5]] as const) {
    const reg = { date: '2026-10-05', result: name };
    assert.equal(currentLimits({ ...base, regime: reg })!.cap, LIMITS.us[name].cap); // off: unchanged
    assert.equal(currentLimits({ ...base, regime: reg, proposals: { usOpenRiskByLight: true, usVixHalving: false }, params: P })!.cap, cap);
  }
  assert.equal(currentLimits({ ...base, market: 'india', regime: { date: '2026-10-05', result: 'yellow' }, proposals: { usOpenRiskByLight: true, usVixHalving: false }, params: P })!.cap, 2.5); // India untouched
});
test('C-34: US VIX above the threshold halves risk only when switched on, and never changes India', () => {
  const reg = { date: '2026-10-05', result: 'green' as const, vix: 30 };
  assert.equal(currentLimits({ ...base, regime: reg })!.risk, 0.5);
  const on = { proposals: { usOpenRiskByLight: false, usVixHalving: true }, params: P };
  assert.equal(currentLimits({ ...base, regime: reg, ...on })!.risk, 0.25);
  assert.equal(currentLimits({ ...base, regime: { ...reg, vix: 25 }, ...on })!.risk, 0.5); // equal to threshold: no
  assert.equal(currentLimits({ ...base, market: 'india', regime: { ...reg, vix: 15 }, ...on })!.risk, 0.5);
});

// ---- C-30 ----
test('C-30: pending orders count full planned size x (trigger - stop); the check reads open + pending + this trade vs cap', () => {
  assert.equal(pendingRiskRs([{ status: 'planned', fullShares: 100, trigger: 100, stop0: 95 }, { status: 'planned', oneR: 700 }, { status: 'open', fullShares: 5, trigger: 1, stop0: 0 }]), 500 + 700);
  const i = { ...chk('1'), limits: { name: 'green' as const, ...LIMITS.india.green }, openRiskRs: 20_000, nt: ntCalc({ setup: '1', basis: 100, chartStop: 92, atr: 2, close: 100, capital: 1_000_000, light: 'green', riskBase: 0.5 }) };
  const cap = 50_000; // 5% of 1,000,000
  const noPend = ntChecks(i).find((x) => x.t.startsWith('Open risk'))!; assert.equal(noPend.s, 'pass'); // 20k + 5k <= 50k
  const withPend = ntChecks({ ...i, pendingRiskRs: 30_000 }).find((x) => x.t.startsWith('Open risk'))!; // 20k + 30k + 5k > 50k
  assert.equal(withPend.s, 'fail'); assert.match(withPend.t, /pending orders/); assert.ok(55_000 > cap);
});

// ---- C-29 ----
const mk = (f: (i: number) => number, n = 80): Bar[] => Array.from({ length: n }, (_, i) => ({ date: `d${String(i).padStart(3, '0')}`, close: f(i) }));
let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const walk = (n = 80) => { let c = 100; const r: number[] = []; for (let i = 0; i < n; i++) { c *= 1 + (rnd() - 0.5) * 0.04; r.push(c); } return r; };
test('C-29: pearson and series correlation on known cases', () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]).toFixed(6), '1.000000');
  assert.equal(pearson([1, 2, 3, 4], [8, 6, 4, 2]).toFixed(6), '-1.000000');
  assert.ok(Number.isNaN(pearson([1, 1, 1], [1, 2, 3])));
  const a = walk(); const A = mk((i) => a[i]); const B = mk((i) => a[i] * 2); // same returns
  assert.ok(seriesCorrelation(A, B, 63) > 0.999);
  assert.ok(Number.isNaN(seriesCorrelation(mk((i) => a[i], 20), B, 63))); // too little history = unknown, not zero
});
test('C-29: more than 50% of open risk in sectors correlated above 0.8 is a breach; independent sectors are not', () => {
  const x = walk(), noise = walk(), other = walk();
  const closes = { IT: mk((i) => x[i]), Software: mk((i) => x[i] * 1.5), Pharma: mk((i) => other[i]), Metal: mk((i) => noise[i]) };
  const r = correlationGuard({ IT: 30, Software: 30, Pharma: 20, Metal: 20 }, closes, P.correlation);
  assert.equal(r.breach, true); assert.deepEqual(r.worst!.sectors, ['IT', 'Software']); assert.equal(r.worst!.share, 0.6);
  const ok1 = correlationGuard({ IT: 20, Software: 20, Pharma: 30, Metal: 30 }, closes, P.correlation);
  assert.equal(ok1.breach, false); assert.equal(ok1.worst!.share, 0.4);
  const solo = correlationGuard({ IT: 100 }, closes, P.correlation); assert.equal(solo.breach, false); // one sector: the per-sector rule's job
  const unk = correlationGuard({ IT: 50, Gold: 50 }, closes, P.correlation); assert.equal(unk.breach, false); assert.deepEqual(unk.unknown, ['Gold', 'IT']);
});
test('C-29 challenger: stock correlation above 0.75 over 60 days is flagged', () => {
  const x = walk(), y = walk();
  const flags = stockCorrelationFlags(mk((i) => x[i]), [{ sym: 'TWIN', closes: mk((i) => x[i] * 3) }, { sym: 'ODD', closes: mk((i) => y[i]) }], P.correlation);
  assert.deepEqual(flags.map((f) => f.sym), ['TWIN']);
});

// ---- C-31 ----
const trade = (i: number, win: boolean, costs?: number) => ({ entryDate: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`, exitDate: `2026-02-${String(1 + (i % 28)).padStart(2, '0')}`, stop0: 90, fullShares: 100, costs,
  lots: [{ shares: 100, price: 100 }], sells: [{ shares: 100, price: win ? 125 : 90 }] });
test('C-31: tier 2 needs 100 trades, positive expectancy after costs, profit factor and drawdown from settings', () => {
  const t = (n: number, wins: number, costs = 0) => Array.from({ length: n }, (_, i) => trade(i, i % 10 < wins, costs));
  const good = journalTier2(t(100, 5), 1_000_000, P.tier2); // 5 of 10 win +2.5R, others -1R
  assert.equal(good.pass, true); assert.ok(good.profitFactor > 2);
  assert.equal(journalTier2(t(99, 5), 1_000_000, P.tier2).pass, false); // 99 trades
  assert.equal(journalTier2(t(100, 5, 2400), 1_000_000, P.tier2).pass, false); // costs of 2,400 per trade wipe out the edge
  assert.equal(journalTier2(t(100, 5, 2400), 1_000_000, P.tier2).costsRecorded, 100);
  assert.equal(journalTier2(t(100, 2), 1_000_000, P.tier2).pass, false); // 20% wins: PF 0.5
});
// ---- C-32 ----
test('C-32: MAE and MFE from daily low and high, entry-day bar left out, exit day included', () => {
  const t = { entryDate: '2026-10-01', exitDate: '2026-10-05', stop0: 90, lots: [{ shares: 10, price: 100 }], sells: [] };
  const bars = [{ date: '2026-10-01', high: 130, low: 50 }, { date: '2026-10-02', high: 108, low: 96 }, { date: '2026-10-05', high: 112, low: 94 }, { date: '2026-10-06', high: 200, low: 1 }];
  const e = excursions(t, bars); assert.equal(e.bars, 2); assert.equal(e.maeR, -0.6); assert.equal(e.mfeR, 1.2);
  assert.equal(closeExcursions(t, 97, 109).maeR, -0.3); // close basis is milder: that is the point of C-32
  assert.ok(Number.isNaN(excursions({ ...t, stop0: 100 }, bars).maeR));
});
