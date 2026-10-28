import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFunds, classOfRow, exposure, MARKET_MIX, type PickRow } from '../src/pm/fundshortlist.ts';
import { routeNewMoney } from '../src/pm/rebalance.ts';
import { TARGET_CLASSES, type TargetClass } from '../src/pm/allocation.ts';

const R = (n: string, g: string, c: string, s: number | null, b: string | null, t = 0.5, i?: string, r5: number | null = 10, pb?: string | null): PickRow => ({ n, g, c, s, b, t, i, r5, pb });
const rows = [R('A Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 94, 'Strong'), R('A2 Value Fund - Direct Plan - Growth', 'mf', 'Value', 93, 'Strong'), R('B Large Fund - Direct Plan - Growth', 'mf', 'Large Cap', 70, 'Average', 0.4, 'INB'), R('C Small Fund - Direct Plan - Growth', 'mf', 'Small Cap', 60, 'Average'),
  R('C2 Small Fund - Direct Plan - Growth', 'mf', 'Small Cap', 85, 'Strong'), R('D Mid Fund - Direct Plan - Growth', 'mf', 'Mid Cap', 20, 'Weak'), R('E Bank Fund - Direct Plan - Growth', 'mf', 'Sectoral/Thematic', 95, 'Strong'), R('F Unscored Fund', 'mf', 'Flexi Cap', null, null), R('G ELSS Fund', 'mf', 'ELSS', 99, 'Strong'),
  R('H Young Mid Fund - Direct Plan - Growth', 'mf', 'Mid Cap', 99, 'Strong', 0.5, undefined, null),
  R('N50 Index A', 'idx', 'Nifty 50', 80, 'Strong', 0.1), R('N50 Index B', 'idx', 'Nifty 50', 78, 'Strong', 0.05), R('N50 Index C', 'idx', 'Nifty 50', 60, 'Weak', 0.01), R('Next50 Index', 'idx', 'Nifty Next 50', 60, 'Average'), R('Sensex ETF', 'idx', 'BSE Sensex', 99, 'Strong', 0.03),
  R('Liquid X', 'debt', 'Liquid', 70, 'Average'), R('Bond Y', 'debt', 'Corporate Bond', 65, 'Average'), R('Gilt Z', 'debt', 'Gilt', 90, 'Strong'), R('Nippon Fixed Maturity Plan - XLV', 'debt', 'Fixed maturity', 99, 'Strong'), R('Bandhan Fixed Term Plan Series - 179', 'debt', 'Income', 98, 'Strong'), R('Nippon Credit Risk Fund (Existing Number of Segregated Portfolios - 1)', 'debt', 'Credit risk', 97, 'Strong')];
test('groups are single categories: the best fund of each, never one pool ranked across categories', () => {
  const p = pickFunds('active_equity_fund', rows);
  assert.deepEqual(p.map((x) => x.group).sort(), ['Flexi Cap', 'Large Cap', 'Small Cap', 'Value']);   // Mid: Weak, or no 5-year record; sector, ELSS and unscored are out
  assert.equal(p.find((x) => x.group === 'Small Cap')!.row.n, 'C2 Small Fund - Direct Plan - Growth');
});
test('a fund with no 5-year record is not picked; once a previous month exists it must have been Strong or Average then too', () => {
  assert.ok(!pickFunds('active_equity_fund', rows).some((x) => x.row.n.startsWith('H ')));
  const withPrev = rows.map((r) => (r.n.startsWith('C2 ') ? { ...r, pb: 'Weak' } : r.n.startsWith('C ') ? { ...r, pb: 'Average' } : { ...r, pb: 'Strong' }));
  const p = pickFunds('active_equity_fund', withPrev, { hasPrev: true });
  assert.equal(p.find((x) => x.group === 'Small Cap')!.row.n, 'C Small Fund - Direct Plan - Growth');   // C2 was Weak last month
});
test('exposure mix: nothing held suggests a diversified fund; a class that is all large cap is moved to mid or small', () => {
  assert.equal(pickFunds('active_equity_fund', rows, { amount: 1000 }).find((x) => x.headline)!.group, 'Flexi Cap');
  const allLarge = [{ isin: 'INB', name: 'B Large Fund Direct Growth', value: 100000 }];
  const g = pickFunds('active_equity_fund', rows, { held: allLarge, amount: 100000 }).find((x) => x.headline)!.group;
  assert.ok(g === 'Flexi Cap' || g === 'Small Cap', g);   // never Large Cap again
  assert.notEqual(g, 'Large Cap');
  assert.deepEqual(exposure('active_equity_fund', 'Flexi Cap'), MARKET_MIX); assert.equal(exposure('index', 'BSE Sensex'), null);
});
test('a fund that is already at the fund cap is not suggested again', () => {
  const held = [{ isin: 'x', name: 'A Flexi Fund Direct Growth', value: 300000 }];
  const p = pickFunds('active_equity_fund', rows, { held, amount: 1000, fundCapAmount: 200000 });
  assert.ok(!p.some((x) => x.row.n.startsWith('A Flexi')));
});
test('a held fund in a group is preferred; the fund being sold is never picked', () => {
  const two = [...rows, R('C3 Small Fund - Direct Plan - Growth', 'mf', 'Small Cap', 80, 'Strong', 0.4, 'INC3')];
  assert.equal(pickFunds('active_equity_fund', two, { held: [{ isin: 'INC3', name: 'x' }] }).find((x) => x.group === 'Small Cap')!.row.i, 'INC3');
  assert.ok(!pickFunds('active_equity_fund', rows, { selling: ['A Flexi Fund Direct Growth'] }).some((x) => x.row.n[0] === 'A' && x.group === 'Flexi Cap'));
});
test('index: cheapest eligible fund per index; Sensex and other overlapping indices are not picked', () => {
  const p = pickFunds('index', rows);
  assert.deepEqual(p.map((x) => x.row.n).sort(), ['N50 Index B', 'Next50 Index']);   // B is cheaper than A; C is Weak so out; Sensex is not a pick
});
test('debt and liquid: every group listed, no headline, no closed-ended plans; sector and ELSS get no class', () => {
  const d = pickFunds('debt', rows); assert.deepEqual(d.map((x) => x.group).sort(), ['Corporate Bond', 'Gilt']); assert.ok(d.every((x) => !x.headline));
  assert.deepEqual(pickFunds('liquid', rows).map((x) => x.row.n), ['Liquid X']);
  assert.equal(classOfRow(rows[6]), null); assert.equal(classOfRow(rows[8]), null);
  assert.deepEqual(pickFunds('gold', rows), []);
});
test('new money: a class over its band is excluded from the spreading of leftover money but not from filling its own shortfall', () => {
  const z = Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0])) as Record<TargetClass, number>;
  const T = [{ cls: 'direct_equity' as TargetClass, target: 0.5 }, { cls: 'debt' as TargetClass, target: 0.3 }, { cls: 'gold' as TargetClass, target: 0.2 }];
  const held = { ...z, direct_equity: 600, debt: 300, gold: 100 };
  for (const amt of [10, 50, 400, 5000]) {
    const r = routeNewMoney(T, held, amt, new Set<TargetClass>(['direct_equity'])), got = r.lines.find((l) => l.cls === 'direct_equity')?.amount ?? 0;
    assert.ok(Math.abs(r.lines.reduce((a, l) => a + l.amount, 0) - amt) < 1);
    assert.ok((600 + got) / (1000 + amt) <= 0.5 + 1e-6 || got === 0);   // never pushed past target, and nothing at all while it is already over target after the money
    if (amt <= 200) assert.equal(got, 0);
  }
  // an excluded class that ends below target after the money still gets its shortfall: 2000 of new money on 1000 held, index 50% of held, target 30%
  const held2 = { ...z, direct_equity: 500, debt: 500 };
  const r2 = routeNewMoney([{ cls: 'direct_equity', target: 0.5 }, { cls: 'debt', target: 0.5 }], held2, 2000, new Set<TargetClass>(['direct_equity']));
  assert.ok(r2.lines.find((l) => l.cls === 'direct_equity')!.amount > 0);   // 0.5 x 3000 = 1500 target, 500 held: a 1000 shortfall is filled
});

test('a fund whose house would pass the household limit is not suggested, and is named', () => {
  const rs = [R('Axis Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 94, 'Strong'), R('Quant Value Fund - Direct Plan - Growth', 'mf', 'Value', 90, 'Strong')];
  const skipped: string[] = [];
  const p = pickFunds('active_equity_fund', rs, { amount: 10000, houseCap: { limit: 0.35, houseValue: { Axis: 60000, Quant: 10000 }, total: 100000, skipped } });
  assert.deepEqual(p.map((x) => x.group), ['Value']);
  assert.equal(skipped.length, 1); assert.match(skipped[0], /Axis/);
  assert.equal(pickFunds('active_equity_fund', rs, { amount: 10000 }).length, 2);   // no cap, both
});
