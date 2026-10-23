import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFunds, classOfRow, groupOf, type PickRow } from '../src/pm/fundshortlist.ts';
import { routeNewMoney } from '../src/pm/rebalance.ts';
import { TARGET_CLASSES, type TargetClass } from '../src/pm/allocation.ts';

const R = (n: string, g: string, c: string, s: number | null, b: string | null, t = 0.5, i?: string): PickRow => ({ n, g, c, s, b, t, i });
const rows = [R('A Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 94, 'Strong'), R('B Large Fund - Direct Plan - Growth', 'mf', 'Large Cap', 70, 'Average', 0.4, 'INB'), R('C Small Fund - Direct Plan - Growth', 'mf', 'Small Cap', 60, 'Average'),
  R('C2 Small Fund - Direct Plan - Growth', 'mf', 'Small Cap', 85, 'Strong'), R('D Mid Fund - Direct Plan - Growth', 'mf', 'Mid Cap', 20, 'Weak'), R('E Bank Fund - Direct Plan - Growth', 'mf', 'Sectoral/Thematic', 95, 'Strong'), R('F Unscored Fund', 'mf', 'Flexi Cap', null, null), R('G ELSS Fund', 'mf', 'ELSS', 99, 'Strong'),
  R('N50 Index A', 'idx', 'Nifty 50', 80, 'Strong', 0.1), R('N50 Index B', 'idx', 'Nifty 50', 78, 'Strong', 0.2), R('Next50 Index', 'idx', 'Nifty Next 50', 60, 'Average'), R('Liquid X', 'debt', 'Liquid', 70, 'Average'), R('Bond Y', 'debt', 'Corporate Bond', 65, 'Average'), R('Gilt Z', 'debt', 'Gilt', 90, 'Strong'), R('Nippon Fixed Maturity Plan - XLV', 'debt', 'Fixed maturity', 99, 'Strong'), R('Bandhan Fixed Term Plan Series - 179', 'debt', 'Income', 98, 'Strong'), R('Nippon Credit Risk Fund (Existing Number of Segregated Portfolios - 1)', 'debt', 'Credit risk', 97, 'Strong'), R('SBI Long Term Advantage Fund - Series V', 'mf', 'ELSS', 96, 'Strong')];
test('active equity: the best fund in each segment, never one pool ranked across categories', () => {
  const p = pickFunds('active_equity_fund', rows);
  assert.deepEqual(p.map((x) => x.group).sort(), ['All-cap', 'Large Cap', 'Small Cap']);   // Mid is Weak, sector and ELSS and unscored are out
  
  assert.equal(p.find((x) => x.group === 'Small Cap')!.row.n, 'C2 Small Fund - Direct Plan - Growth');
  assert.equal(groupOf(rows[0]), 'All-cap');
});
test('headline group is the one you hold least of; with nothing held it follows the core order', () => {
  assert.equal(pickFunds('active_equity_fund', rows).find((x) => x.headline)!.group, 'All-cap');
  const held = [{ isin: 'x', name: 'A Flexi Fund Direct Growth', value: 500 }, { name: 'B Large Fund Direct Growth', value: 100 }];
  const p = pickFunds('active_equity_fund', rows, held);
  assert.equal(p[0].group, 'Small Cap'); assert.ok(p[0].headline); assert.ok(p.filter((x) => x.headline).length === 1);
});
test('a held fund in the top 3 of its group is preferred; the fund being sold is never picked', () => {
  const two = [...rows, R('C3 Small Fund - Direct Plan - Growth', 'mf', 'Small Cap', 80, 'Strong', 0.4, 'INC3')];
  assert.equal(pickFunds('active_equity_fund', two, [{ isin: 'INC3', name: 'x' }]).find((x) => x.group === 'Small Cap')!.row.i, 'INC3');
  assert.ok(!pickFunds('active_equity_fund', rows, [], ['A Flexi Fund Direct Growth']).some((x) => x.row.n[0] === 'A'));
});
test('index: best per index; debt and liquid: every group listed, no headline; sector gets no class', () => {
  assert.deepEqual(pickFunds('index', rows).map((x) => x.row.n), ['N50 Index A', 'Next50 Index']);
  const d = pickFunds('debt', rows); assert.deepEqual(d.map((x) => x.group).sort(), ['Corporate Bond', 'Gilt']);   // no fixed-term, fixed-maturity, segregated-portfolio or Income picks assert.ok(d.every((x) => !x.headline));
  assert.deepEqual(pickFunds('liquid', rows).map((x) => x.row.n), ['Liquid X']);
  assert.equal(classOfRow(rows[5]), null); assert.equal(classOfRow(rows[7]), null);
  assert.deepEqual(pickFunds('gold', rows), []);
});
test('new money never goes to an excluded class, even when it exceeds every shortfall', () => {
  const z = Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0])) as Record<TargetClass, number>;
  const T = [{ cls: 'direct_equity' as TargetClass, target: 0.5 }, { cls: 'debt' as TargetClass, target: 0.3 }, { cls: 'gold' as TargetClass, target: 0.2 }];
  const held = { ...z, direct_equity: 600, debt: 300, gold: 100 };
  for (const amt of [10, 50, 400, 5000]) { const r = routeNewMoney(T, held, amt, new Set<TargetClass>(['direct_equity'])); assert.ok(!r.lines.some((l) => l.cls === 'direct_equity')); assert.ok(Math.abs(r.lines.reduce((a, l) => a + l.amount, 0) - amt) < 1); }
});
