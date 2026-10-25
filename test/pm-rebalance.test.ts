import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeNewMoney, planSales, sellNeeds, type OpenLot } from '../src/pm/rebalance.ts';
import { TARGET_CLASSES, type TargetClass } from '../src/pm/allocation.ts';

const rules = JSON.parse(readFileSync('data/rules/tax.json', 'utf8'));
const zero = () => Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0])) as Record<TargetClass, number>;
const settings = { minTrade: 10000, maxCostShare: 0.03 };
const lot = (o: Partial<OpenLot>): OpenLot => ({ name: 'X', kind: 'Stock', book: 'Legacy', assetClass: 'direct_equity', type: 'listed_equity', date: '2020-01-01', qty: 100, unitCost: 100, price: 200, ...o });
const T = [{ cls: 'direct_equity' as const, target: 0.3 }, { cls: 'debt' as const, target: 0.5 }, { cls: 'gold' as const, target: 0.2 }];

test('new money fills shortfalls first, sums to the amount, never goes negative', () => {
  const held = { ...zero(), direct_equity: 500, debt: 300, gold: 200 };
  const r = routeNewMoney(T, held, 400);
  assert.ok(Math.abs(r.lines.reduce((a, l) => a + l.amount, 0) - 400) < 1e-9);
  assert.ok(r.lines.every((l) => l.amount > 0));
  assert.ok(!r.lines.some((l) => l.cls === 'direct_equity'), 'overweight class gets nothing while others are short');
  const big = routeNewMoney(T, held, 5000);   // more than all shortfalls: surplus by target weight
  assert.ok(Math.abs(big.lines.reduce((a, l) => a + l.amount, 0) - 5000) < 1e-9);
  assert.ok(routeNewMoney(T, held, 0).error);
});
test('new money property: random inputs always sum to the amount with no negative line', () => {
  let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let n = 0; n < 2000; n++) { const held = { ...zero(), direct_equity: rnd() * 1e6, debt: rnd() * 1e6, gold: rnd() * 1e5 }, amt = 1 + rnd() * 1e6, r = routeNewMoney(T, held, amt); assert.ok(Math.abs(r.lines.reduce((a, l) => a + l.amount, 0) - amt) < 1e-6); assert.ok(r.lines.every((l) => l.amount >= 0)); }
});
test('sale needs only for classes above target plus band, after new money', () => {
  const held = { ...zero(), direct_equity: 500, debt: 300, gold: 200 };
  assert.deepEqual(Object.keys(sellNeeds(T, held, () => 0.05)), ['direct_equity']);
  assert.deepEqual(Object.keys(sellNeeds(T, held, () => 0.05, { debt: 700 })), ['debt']);   // too much new money in one class pushes it over its band
  assert.deepEqual(sellNeeds(T, held, () => 0.05, { debt: 600, gold: 200 }), {});
  assert.ok(!('direct_equity' in sellNeeds(T, held, () => 0.5)));
});
test('band-edge sizing sells only back to the edge of the band (C-86), never to target', () => {
  const held = { ...zero(), direct_equity: 500, debt: 300, gold: 200 };   // total 1000
  const tgt = sellNeeds(T, held, () => 0.05)['direct_equity']!, edge = sellNeeds(T, held, () => 0.05, {}, true)['direct_equity']!;
  assert.ok(Math.abs(tgt - edge - 50) < 1e-9);   // 5 points of 1000 less than selling to target
  assert.ok(edge > 0);
  assert.deepEqual(sellNeeds(T, held, () => 0.5, {}, true), {});
});
test('sale order: exit names, then loss lots, then long-term equity, then short-term; Swing book and locked ELSS never sold', () => {
  const today = '2026-10-20';
  const lots = [lot({ name: 'ShortGain', date: '2026-08-01', unitCost: 150 }), lot({ name: 'LongGain' }), lot({ name: 'LossLot', unitCost: 300 }), lot({ name: 'ExitName', unitCost: 190 }), lot({ name: 'SwingLot', book: 'Swing', unitCost: 300 }), lot({ name: 'ELSS', assetClass: 'direct_equity', locked: true, unitCost: 300 })];
  const p = planSales(lots, { direct_equity: 30000 }, { today, rules, exit: new Set(['ExitName']), settings });
  assert.deepEqual(p.lines.map((l) => l.name), ['ExitName', 'LossLot']);   // 20,000 + 20,000 covers 30,000 need
  const p2 = planSales(lots, { direct_equity: 70000 }, { today, rules, exit: new Set(['ExitName']), settings });
  assert.deepEqual(p2.lines.map((l) => l.name), ['ExitName', 'LossLot', 'LongGain', 'ShortGain'].slice(0, p2.lines.length));
  assert.ok(!p2.lines.some((l) => l.name === 'SwingLot' || l.name === 'ELSS'));
});
test('C-90: Weak-fund lots sell after Exit names and before loss lots, and still face the cost gate', () => {
  const today = '2026-10-20', lots = [lot({ name: 'LossLot', unitCost: 300 }), lot({ name: 'WeakFund', unitCost: 190 }), lot({ name: 'ExitName', unitCost: 190 })];
  const p = planSales(lots, { direct_equity: 60000 }, { today, rules, exit: new Set(['ExitName']), weak: new Set(['WeakFund']), settings });
  assert.deepEqual(p.lines.map((l) => l.name), ['ExitName', 'WeakFund', 'LossLot']);
  assert.equal(p.lines[1].group, 'Weak fund');
  const q = planSales([lot({ name: 'WeakFund', date: '2026-09-01', qty: 1000, unitCost: 10, price: 200 })], { direct_equity: 200000 }, { today, rules, weak: new Set(['WeakFund']), settings });
  assert.equal(q.lines.length, 0); assert.equal(q.skipped.length, 1);
});
test('tax: long-term equity gain uses the exemption then 12.5%; short-term 20%; slab types carry no tax figure', () => {
  const today = '2026-10-20';
  const a = planSales([lot({ name: 'LT', qty: 1000, unitCost: 100, price: 400 })], { direct_equity: 400000 }, { today, rules, exemptionLeft: 125000, settings: { minTrade: 1, maxCostShare: 1 } });
  assert.equal(a.lines[0].gain, 300000); assert.ok(Math.abs((a.lines[0].tax as number) - (300000 - 125000) * 0.125) < 1e-6);
  const b = planSales([lot({ name: 'ST', qty: 1000, unitCost: 100, price: 200, date: '2026-09-01' })], { direct_equity: 200000 }, { today, rules, settings: { minTrade: 1, maxCostShare: 1 } });
  assert.ok(Math.abs((b.lines[0].tax as number) - 100000 * 0.2) < 1e-6);
  const c = planSales([lot({ name: 'Gold', assetClass: 'gold', type: 'gold_silver_etf', date: '2026-09-01', qty: 1000, unitCost: 100, price: 200 })], { gold: 200000 }, { today, rules, settings: { minTrade: 1, maxCostShare: 1 } });
  assert.equal(c.lines[0].tax, null); assert.equal(c.slabGains, 100000);
});
test('skips: below minimum trade and too costly; unmet need is reported, never invented', () => {
  const today = '2026-10-20';
  const small = planSales([lot({ name: 'Tiny', qty: 10, price: 200 })], { direct_equity: 2000 }, { today, rules, settings });
  assert.equal(small.lines.length, 0); assert.ok(/minimum trade/.test(small.skipped[0].why));
  const costly = planSales([lot({ name: 'ShortBig', date: '2026-09-01', qty: 1000, unitCost: 10, price: 200 })], { direct_equity: 200000 }, { today, rules, settings });
  assert.equal(costly.lines.length, 0); assert.ok(/limit/.test(costly.skipped[0].why)); assert.equal(costly.unmet.length, 1);
  const none = planSales([], { debt: 50000 }, { today, rules, settings }); assert.equal(none.unmet[0].cls, 'debt');
});
test('property: planned sales never exceed the need by more than one unit and never touch protected lots', () => {
  let s = 3; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let n = 0; n < 500; n++) {
    const lots = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => lot({ name: 'L' + i, qty: 1 + Math.floor(rnd() * 500), unitCost: 50 + rnd() * 300, price: 50 + rnd() * 300, date: rnd() < 0.5 ? '2019-05-01' : '2026-08-01', book: rnd() < 0.2 ? 'Swing' : 'Legacy', locked: rnd() < 0.1 }));
    const need = 20000 + rnd() * 400000, p = planSales(lots, { direct_equity: need }, { today: '2026-10-20', rules, settings: { minTrade: 5000, maxCostShare: 1 } });
    const sold = p.lines.reduce((a, l) => a + l.value, 0); assert.ok(sold <= need + 1e-6 + 400, `sold ${sold} need ${need}`);
    for (const l of p.lines) { const src = lots.find((x) => x.name === l.name)!; assert.ok(src.book !== 'Swing' && !src.locked && l.qty <= src.qty); }
  }
});

import { applyQuarterCap, quarterOf, inLoad } from '../src/pm/rebalance.ts';
test('quarter cap: held back inside the quarter unless drift passes twice the band', () => {
  const held: any = { direct_equity: 600, index: 400 }, targets: any = [{ cls: 'direct_equity', target: 0.5 }, { cls: 'index', target: 0.5 }];
  const base = { held, targets, band: () => 0.05, today: '2026-11-10' };
  assert.equal(quarterOf('2026-10-01'), '2026Q4'); assert.equal(quarterOf('2026-09-30'), '2026Q3');
  const a = applyQuarterCap({ direct_equity: 100 }, { ...base, acted: { direct_equity: '2026-10-20' } });
  assert.deepEqual(a.need, {}); assert.equal(a.held[0].cls, 'direct_equity');
  const b = applyQuarterCap({ direct_equity: 100 }, { ...base, acted: { direct_equity: '2026-08-20' } });
  assert.equal(b.need.direct_equity, 100);
  const c = applyQuarterCap({ direct_equity: 300 }, { ...base, held: { direct_equity: 800, index: 200 } as any, acted: { direct_equity: '2026-10-20' } });
  assert.equal(c.need.direct_equity, 300, 'drift 30pp is past twice the 5pp band');
});
test('slab rate prices slab lines; with none set they carry no figure', () => {
  const rules: any = { types: { debt_fund: { long_after_days: null, exemption: false, rules: [{ transfer_from: '2020-01-01', stcg: 'slab', ltcg: 'slab' }] } } };
  const lot: any = { name: 'D', kind: 'Fund', book: 'Legacy', assetClass: 'debt', type: 'debt_fund', date: '2026-01-01', qty: 100, unitCost: 100, price: 200 };
  const set: any = { minTrade: 1000, maxCostShare: 0.5 };
  const none = planSales([lot], { debt: 10000 }, { today: '2026-10-20', rules, settings: set });
  assert.equal(none.lines[0].tax, null); assert.equal(none.slabGains, 5000);
  const priced = planSales([lot], { debt: 10000 }, { today: '2026-10-20', rules, settings: set, slabRate: 0.3 });
  assert.equal(priced.lines[0].tax, 1500); assert.equal(priced.slabGains, 0);
});
test('exit load: counted in cost, lots outside the window sell first, unknown load on a recent fund lot is flagged', () => {
  const rules: any = { types: { equity_fund: { long_after_days: 365, exemption: true, rules: [{ transfer_from: '2020-01-01', stcg: 0.2, ltcg: 0.125 }] } } };
  const mk = (name: string, date: string, exitLoad?: any): any => ({ name, kind: 'Fund', book: 'Legacy', assetClass: 'active_equity_fund', type: 'equity_fund', date, qty: 100, unitCost: 100, price: 100, ...(exitLoad !== undefined ? { exitLoad } : {}) });
  const set: any = { minTrade: 1000, maxCostShare: 0.5 };
  const p = planSales([mk('Inside', '2026-09-01', { days: 365, pct: 0.01 }), mk('Outside', '2024-01-01', { days: 365, pct: 0.01 })], { active_equity_fund: 9000 }, { today: '2026-10-20', rules, settings: set });
  assert.equal(p.lines[0].name, 'Outside'); assert.ok(inLoad(mk('x', '2026-09-01', { days: 365, pct: 0.01 }), '2026-10-20'));
  const q = planSales([mk('Inside', '2026-09-01', { days: 365, pct: 0.01 })], { active_equity_fund: 9000 }, { today: '2026-10-20', rules, settings: set });
  assert.equal(q.lines[0].load, 90); assert.match(q.lines[0].loadNote!, /exit load 1.00%/);
  const u = planSales([mk('Unknown', '2026-09-01')], { active_equity_fund: 9000 }, { today: '2026-10-20', rules, settings: set });
  assert.match(u.lines[0].loadNote!, /no exit load is recorded/);
});

import { loadRate, loadEndDays } from '../src/pm/rebalance.ts';
test('tiered exit load with free units', () => {
  const ppfas = { days: 365, pct: 0.02, tiers: [{ days: 366, pct: 0.02 }, { days: 731, pct: 0.01 }], free: 0.1 };
  assert.equal(loadRate(ppfas, 100).toFixed(4), '0.0180');
  assert.equal(loadRate(ppfas, 365).toFixed(4), '0.0180');
  assert.equal(loadRate(ppfas, 400).toFixed(4), '0.0090');
  assert.equal(loadRate(ppfas, 731), 0);
  assert.equal(loadEndDays(ppfas), 731);
  const liq = { days: 6, pct: 0.00007, tiers: [{ days: 1, pct: 0.00007 }, { days: 6, pct: 0.000045 }] };
  assert.equal(loadRate(liq, 0), 0.00007); assert.equal(loadRate(liq, 3), 0.000045); assert.equal(loadRate(liq, 7), 0);
  assert.equal(loadRate({ days: 365, pct: 0.01 }, 364), 0.01); assert.equal(loadRate(undefined, 1), 0);
});
