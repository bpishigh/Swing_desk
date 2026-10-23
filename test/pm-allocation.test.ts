import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollUp, allocate, interp, TARGET_CLASSES, currentByClass, gapRows, capBreaches, type AllocSettings, type AllocInput, type Profile } from '../src/pm/allocation.ts';
import { assetClassOf } from '../src/pm/assetclass.ts';

const S: AllocSettings = JSON.parse(readFileSync('settings/allocation.json', 'utf8'));
const PROFILES: Profile[] = ['Cautious', 'Balanced', 'Aggressive'], HORIZONS = [0, 1, 2, 3, 5, 7, 10, 15, 20, 30, 40];
const SCOPES = [undefined, ['direct_equity', 'index', 'debt', 'liquid'], ['index', 'gold', 'debt'], ['active_equity_fund', 'index', 'international', 'debt', 'gold', 'silver', 'liquid']] as AllocInput['inScope'][];
const CAPSETS: AllocInput['caps'][] = [undefined, { classMax: { debt: 0.4 } }, { classMin: { gold: 0.1 }, classMax: { index: 0.2 } }, { classMax: { debt: 0.1, liquid: 0.05, gold: 0.05, silver: 0.01 } }, { classMin: { debt: 0.5, liquid: 0.3, gold: 0.3 } }];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Property 1: every combination returns targets that add to 100% inside every cap, or a plain clash message; never a guess.
test('every input combination adds to 100% within all caps, or says which constraints clash', () => {
  let ok = 0, clash = 0;
  for (const profile of PROFILES) for (const h of HORIZONS) for (const inScope of SCOPES) for (const caps of CAPSETS) {
    const r = allocate(S, { capital: 1_000_000, profile, horizonYears: h, inScope, caps });
    if (r.ok) {
      ok++; assert.ok(Math.abs(sum(r.rows.map((x) => x.target)) - 1) < 1e-9, `sum ${profile} ${h}`);
      for (const x of r.rows) { assert.ok(x.target >= x.min - 1e-9 && x.target <= x.max + 1e-9, `${x.cls} ${x.target} outside [${x.min},${x.max}] for ${profile} ${h}`); assert.ok(Math.abs(x.amount - x.target * 1_000_000) < 1e-6); }
      assert.ok(Math.abs(r.positionCapAmount - r.positionCap * 1_000_000) < 1e-6);
    } else { clash++; assert.ok(r.error.length > 10 && r.clashes.length > 0, `clash without a message: ${profile} ${h}`); }
  }
  assert.ok(ok > 200 && clash > 5, `grid should include both outcomes (ok ${ok}, clash ${clash})`);
});

test('custom weights: valid ones pass through; broken ones name the clash', () => {
  const good = allocate(S, { capital: 1e6, profile: 'Custom', horizonYears: 5, custom: { index: 0.4, debt: 0.4, gold: 0.1, direct_equity: 0.1 } });
  assert.ok(good.ok && Math.abs(sum(good.rows.map((r) => r.target)) - 1) < 1e-9);
  const bad1 = allocate(S, { capital: 1e6, profile: 'Custom', horizonYears: 5, custom: { index: 0.9, debt: 0.1 } });
  assert.ok(!bad1.ok && bad1.clashes.some((c) => /Index/i.test(c) && /maximum/.test(c)));
  const bad2 = allocate(S, { capital: 1e6, profile: 'Custom', horizonYears: 5, custom: { index: 0.3, debt: 0.3 } });
  assert.ok(!bad2.ok && /not 100%/.test(bad2.error));
});
test('impossible requests give a message', () => {
  assert.ok(!allocate(S, { capital: 0, profile: 'Balanced', horizonYears: 5 }).ok);
  const r = allocate(S, { capital: 1e6, profile: 'Balanced', horizonYears: 5, inScope: ['gold'] }); assert.ok(!r.ok && r.clashes.length);
  const m = allocate(S, { capital: 1e6, profile: 'Balanced', horizonYears: 5, caps: { classMin: { debt: 0.7, liquid: 0.2, gold: 0.2 } } }); assert.ok(!m.ok && /minimums/.test(m.error));
});

// Property 2: bounded response to a one-notch change. Horizon: continuous; weights move by no more than the steepest curve slope times the step.
test('one-notch changes move targets by a bounded amount', () => {
  const dist = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  const tg = (i: Partial<AllocInput>) => { const r = allocate(S, { capital: 1e6, profile: 'Balanced', horizonYears: 7, ...i }); assert.ok(r.ok); return r.ok ? r.rows.map((x) => x.target) : []; };
  // horizon step of 0.1 years across the whole range, all profiles: change per class under 1% (steepest anchor slope is ~0.05/yr on equity)
  for (const profile of PROFILES) for (let h = 0; h < 40; h += 0.1) assert.ok(dist(tg({ profile, horizonYears: h }), tg({ profile, horizonYears: h + 0.1 })) < 0.012, `jump at ${profile} ${h.toFixed(1)}`);
  // one year either side of every anchor edge: no flip
  for (const profile of PROFILES) for (const a of S.horizonAnchors) assert.ok(dist(tg({ profile, horizonYears: Math.max(0, a - 0.01) }), tg({ profile, horizonYears: a + 0.01 })) < 0.002);
  // a notch of profile (Cautious→Balanced→Aggressive) moves any class by at most 25 percentage points
  for (const h of HORIZONS) { assert.ok(dist(tg({ profile: 'Cautious', horizonYears: h }), tg({ profile: 'Balanced', horizonYears: h })) <= 0.25); assert.ok(dist(tg({ profile: 'Balanced', horizonYears: h }), tg({ profile: 'Aggressive', horizonYears: h })) <= 0.25); }
  // a notch of cap (2 points on a class maximum) moves any class by at most 2 points + redistribution (bounded by 4 points)
  for (const profile of PROFILES) for (const h of [3, 10, 25]) { const a = tg({ profile, horizonYears: h, caps: { classMax: { index: 0.20 } } }), b = tg({ profile, horizonYears: h, caps: { classMax: { index: 0.22 } } }); assert.ok(dist(a, b) <= 0.04); }
  // switching one class off moves the rest by no more than that class's preset weight
  const full = allocate(S, { capital: 1e6, profile: 'Balanced', horizonYears: 10 }), off = allocate(S, { capital: 1e6, profile: 'Balanced', horizonYears: 10, inScope: TARGET_CLASSES.filter((c) => c !== 'international') });
  assert.ok(full.ok && off.ok); if (full.ok && off.ok) assert.ok(dist(full.rows.filter((r) => r.cls !== 'international').map((r) => r.target), off.rows.map((r) => r.target)) <= (full.rows.find((r) => r.cls === 'international')!.target) + 1e-9);
});
test('equity share is monotone in horizon and in profile', () => {
  for (const p of PROFILES) { let prev = -1; for (const h of [0, 3, 7, 15, 30]) { const e = interp(S.horizonAnchors, S.equityShare[p], h); assert.ok(e >= prev); prev = e; } }
  for (const h of HORIZONS) assert.ok(interp(S.horizonAnchors, S.equityShare.Cautious, h) <= interp(S.horizonAnchors, S.equityShare.Balanced, h) && interp(S.horizonAnchors, S.equityShare.Balanced, h) <= interp(S.horizonAnchors, S.equityShare.Aggressive, h));
});

test('current position, hybrid fold, drift bands, cap breaches', () => {
  const held = [{ name: 'A', value: 400, cls: 'direct_equity' as const, kind: 'Stock' }, { name: 'MA', value: 200, cls: 'hybrid' as const, category: 'Hybrid Scheme - Multi Asset Allocation', kind: 'Fund' }, { name: 'D', value: 300, cls: 'debt' as const, kind: 'Fund' }, { name: 'X', value: 100, cls: null, kind: 'Fund' }, { name: 'P', value: null, cls: 'debt' as const, kind: 'Fund' }];
  const c = currentByClass(S, held); assert.equal(c.unclassified, 100); assert.equal(c.unpriced, 1);
  assert.ok(Math.abs(c.byClass.active_equity_fund - 100) < 1e-9 && Math.abs(c.byClass.debt - 350) < 1e-9 && Math.abs(c.byClass.gold - 50) < 1e-9 && c.total === 900);
  const r = allocate(S, { capital: 900, profile: 'Balanced', horizonYears: 7 }); assert.ok(r.ok);
  if (r.ok) { const g = gapRows(S, r.rows, c.byClass, c.total); assert.equal(g.find((x) => x.cls === 'direct_equity')!.state, 'overweight'); assert.ok(g.every((x) => Math.abs(x.current - c.byClass[x.cls] / 900) < 1e-9)); }
  assert.deepEqual(capBreaches(held, 900, 0.3, 0.2).map((x) => x.name), ['A', 'D', 'MA']);
});
test('tax class settles the asset class when the name does not', () => {
  assert.equal(assetClassOf('ETF', 'XYZ 12345', '', 'gold_silver_etf'), 'gold');
  assert.equal(assetClassOf('ETF', 'ABC SILVR', '', 'gold_silver_etf'), 'silver');
  assert.equal(assetClassOf('ETF', 'Some Silver Thing', '', 'gold_silver_etf'), 'silver');
  assert.equal(assetClassOf('ETF', 'ZZZ', '', 'intl_etf'), 'international');
  assert.equal(assetClassOf('Fund', 'Odd Fund', '', 'debt_fund'), 'debt');
  assert.equal(assetClassOf('Fund', 'Odd Fund', '', 'equity_fund'), 'active_equity_fund');
});
test('asset class mapping', () => {
  const t: [any, string, string, any][] = [
    ['Stock', 'Sample Ltd', '', 'direct_equity'], ['ETF', 'Nippon India ETF Gold BeES', '', 'gold'], ['ETF', 'Nippon India Silver ETF', '', 'silver'], ['ETF', 'GOLDBEES', '', 'gold'], ['ETF', 'SILVERBEES', '', 'silver'], ['ETF', 'NIFTYBEES', '', 'index'], ['ETF', 'BANKBEES', '', 'sector_thematic'], ['ETF', 'LIQUIDBEES', '', 'liquid'], ['ETF', 'MON100', '', 'international'], ['ETF', 'HNGSNGBEES', '', 'international'], ['ETF', 'JUNIORBEES', '', 'index'], ['ETF', 'Nippon India ETF Nifty 50 BeES', '', 'index'], ['ETF', 'Nippon India ETF Bank BeES', '', 'sector_thematic'], ['ETF', 'Mirae Asset S&P 500 Top 50 ETF', '', 'international'],
    ['Fund', 'Epsilon Flexi Cap Fund', 'Equity Scheme - Flexi Cap Fund', 'active_equity_fund'], ['Fund', 'UTI Nifty 50 Index Fund', 'Other Scheme - Index Funds', 'index'], ['Fund', 'Motilal Oswal Nasdaq 100 FOF', 'Other Scheme - FoF Overseas', 'international'],
    ['Fund', 'HDFC Balanced Advantage Fund', 'Hybrid Scheme - Balanced Advantage Fund', 'hybrid'], ['Fund', 'HDFC Liquid Fund', 'Debt Scheme - Liquid Fund', 'liquid'], ['Fund', 'ICICI Corporate Bond Fund', 'Debt Scheme - Corporate Bond Fund', 'debt'], ['Fund', 'SBI Technology Opportunities', 'Equity Scheme - Sectoral/Thematic', 'sector_thematic'], ['Fund', 'Mystery Fund', 'Solution Oriented Scheme - Retirement Fund', null]];
  for (const [k, n, c, want] of t) assert.equal(assetClassOf(k, n, c), want, n);
});

// Randomised fuzz on top of the grid: arbitrary scopes, caps, horizons, capital and custom weights. Whatever the input, the result is a valid allocation or a clash with a message.
test('fuzz: 20,000 random inputs never break the invariants', () => {
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  let ok = 0, bad = 0;
  for (let n = 0; n < 20000; n++) {
    const scope = TARGET_CLASSES.filter(() => rnd() < 0.7), classMin: any = {}, classMax: any = {};
    for (const c of TARGET_CLASSES) { if (rnd() < 0.2) classMin[c] = Math.round(rnd() * 40) / 100; if (rnd() < 0.3) classMax[c] = Math.round(rnd() * 100) / 100; }
    const profile = pick(['Cautious', 'Balanced', 'Aggressive', 'Custom'] as const), cap = Math.round(rnd() * 1e7) + (rnd() < 0.02 ? 0 : 1000);
    let custom: any; if (profile === 'Custom') { custom = {}; let left = 1; for (const c of TARGET_CLASSES) if (rnd() < 0.5) { const v = Math.round(rnd() * left * 100) / 100; custom[c] = v; left -= v; } }
    const r = allocate(S, { capital: cap, profile, horizonYears: rnd() * 50, inScope: scope.length ? scope : undefined, caps: { classMin, classMax }, custom });
    if (r.ok) {
      ok++; assert.ok(Math.abs(sum(r.rows.map((x) => x.target)) - 1) < 1e-8, 'sum');
      for (const x of r.rows) { assert.ok(Number.isFinite(x.target) && x.target >= x.min - 1e-8 && x.target <= x.max + 1e-8, `cap ${x.cls}`); assert.ok(x.target >= -1e-12); }
      assert.ok(Number.isFinite(r.drawdownLimit) && r.drawdownLimit >= 0 && r.drawdownLimit <= S.bearMarketEquityFall + 1e-9);
    } else { bad++; assert.ok(r.error.length > 5, 'message'); }
  }
  assert.ok(ok > 1000 && bad > 1000, `both outcomes exercised (ok ${ok}, clash ${bad})`);
});
test('default runs do not hit a class maximum; drawdown limit follows the equity share; hybrid fold values', () => {
  for (const p of PROFILES) for (const h of HORIZONS) { const r = allocate(S, { capital: 1e6, profile: p, horizonYears: h }); assert.ok(r.ok); if (r.ok) { assert.ok(r.rows.every((x) => !/held at its maximum/.test(x.rule)), `${p} ${h} hit a maximum`); assert.ok(Math.abs(r.drawdownLimit - r.equityShare * S.bearMarketEquityFall) < 1e-12); } }
  const a = allocate(S, { capital: 1e6, profile: 'Cautious', horizonYears: 0 }), b = allocate(S, { capital: 1e6, profile: 'Cautious', horizonYears: 30 });
  assert.ok(a.ok && b.ok && a.drawdownLimit < b.drawdownLimit);
  assert.equal(currentByClass(S, [{ name: 'x', value: 100, cls: 'hybrid', category: 'Hybrid Scheme - Balanced Advantage Fund', kind: 'Fund' }]).byClass.active_equity_fund, 40);
});
test('typed outside holdings (EPF) count toward their class and are never flagged as cap breaches', () => {
  const held = [{ name: 'Stock', value: 100, cls: 'direct_equity' as const, kind: 'Stock' }, { name: 'EPF', value: 900, cls: 'debt' as const, kind: 'Outside' }];
  const c = currentByClass(S, held); assert.equal(c.byClass.debt, 900); assert.equal(c.total, 1000);
  assert.deepEqual(capBreaches(held, 1000, 0.05, 0.15).map((x) => x.name), ['Stock'].filter(() => 100 / 1000 > 0.05));
  assert.ok(!capBreaches(held, 1000, 0.05, 0.15).some((x) => x.name === 'EPF'));
});

test('household roll-up: each account has its own capital and profile; the household is the sum of their own targets and holdings', () => {
  const a = allocate(S, { capital: 1_200_000, profile: 'Aggressive', horizonYears: 20 }), b = allocate(S, { capital: 800_000, profile: 'Cautious', horizonYears: 3 });
  assert.ok(a.ok && b.ok); if (!a.ok || !b.ok) return;
  const z = () => Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0])) as Record<(typeof TARGET_CLASSES)[number], number>;
  const ca = { ...z(), direct_equity: 300_000, debt: 100_000 }, cb = { ...z(), gold: 50_000 };
  const r = rollUp(S, [{ capital: 1_200_000, rows: a.rows, byClass: ca, unclassified: 10 }, { capital: 800_000, rows: b.rows, byClass: cb, unclassified: 5 }]);
  assert.equal(r.capital, 2_000_000); assert.equal(r.unclassified, 15);
  assert.ok(Math.abs(r.rows.reduce((x, y) => x + y.targetAmount, 0) - 2_000_000) < 1e-6);
  const eq = r.rows.find((x) => x.cls === 'direct_equity')!; assert.ok(Math.abs(eq.targetAmount - (a.rows.find((x) => x.cls === 'direct_equity')!.amount + b.rows.find((x) => x.cls === 'direct_equity')!.amount)) < 1e-6); assert.equal(eq.currentAmount, 300_000);
  assert.ok(Math.abs(r.rows.reduce((x, y) => x + y.target, 0) - 1) < 1e-9);
});

import { scaledBand } from '../src/pm/allocation.ts';
test('scaledBand: never more than half of the target, at least 1 point, configured band otherwise', () => {
  const s = { driftBand: { default: 0.05, silver: 0.02, sector_thematic: 0.03 } };
  assert.equal(scaledBand(s, 'debt', 0.3), 0.05);          // a large target keeps the configured band
  assert.equal(scaledBand(s, 'international', 0.04), 0.02); // small target: half of it
  assert.equal(scaledBand(s, 'silver', 0.01), 0.01);        // never below 1 point
  assert.equal(scaledBand(s, 'silver', 0.5), 0.02);
});
