import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFunds, classOfRow, type PickRow } from '../src/pm/fundshortlist.ts';
import { routeNewMoney } from '../src/pm/rebalance.ts';
import { TARGET_CLASSES, type TargetClass } from '../src/pm/allocation.ts';

const R = (n: string, g: string, c: string, s: number | null, b: string | null, t = 0.5, i?: string): PickRow => ({ n, g, c, s, b, t, i });
const rows = [R('A Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 90, 'Strong'), R('B Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 70, 'Average', 0.4, 'INB'), R('C Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 60, 'Average'), R('D Flexi Fund - Direct Plan - Growth', 'mf', 'Flexi Cap', 20, 'Weak'), R('E Bank Fund - Direct Plan - Growth', 'mf', 'Sectoral/Thematic', 95, 'Strong'), R('F Unscored Fund', 'mf', 'Flexi Cap', null, null),
  R('N50 Index A', 'idx', 'Nifty 50', 80, 'Strong', 0.1), R('N50 Index B', 'idx', 'Nifty 50', 78, 'Strong', 0.2), R('Next50 Index', 'idx', 'Nifty Next 50', 60, 'Average'), R('Liquid X', 'debt', 'Liquid', 70, 'Average'), R('Bond Y', 'debt', 'Corporate Bond', 65, 'Average')];
test('picks only Strong or Average plain-equity funds, ranked by score', () => {
  const p = pickFunds('active_equity_fund', rows);
  assert.deepEqual(p.map((x) => x.row.n[0]), ['A', 'B', 'C']);
  assert.ok(!p.some((x) => ['D', 'E', 'F'].includes(x.row.n[0])));
});
test('a held fund that is on the list goes first; the fund being sold is never picked', () => {
  assert.equal(pickFunds('active_equity_fund', rows, [{ isin: 'INB', name: 'x' }])[0].row.n[0], 'B');
  assert.ok(!pickFunds('active_equity_fund', rows, [], ['A Flexi Fund Direct Growth']).some((x) => x.row.n[0] === 'A'));
});
test('index funds: one per index; liquid and debt are separate classes; sector gets no class', () => {
  assert.deepEqual(pickFunds('index', rows).map((x) => x.row.n), ['N50 Index A', 'Next50 Index']);
  assert.deepEqual(pickFunds('liquid', rows).map((x) => x.row.n), ['Liquid X']);
  assert.deepEqual(pickFunds('debt', rows).map((x) => x.row.n), ['Bond Y']);
  assert.equal(classOfRow(rows[4]), null);
  assert.deepEqual(pickFunds('gold', rows), []);
});
test('new money never goes to an excluded class, even when it exceeds every shortfall', () => {
  const z = Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0])) as Record<TargetClass, number>;
  const T = [{ cls: 'direct_equity' as TargetClass, target: 0.5 }, { cls: 'debt' as TargetClass, target: 0.3 }, { cls: 'gold' as TargetClass, target: 0.2 }];
  const held = { ...z, direct_equity: 600, debt: 300, gold: 100 };
  for (const amt of [10, 50, 400, 5000]) { const r = routeNewMoney(T, held, amt, new Set<TargetClass>(['direct_equity'])); assert.ok(!r.lines.some((l) => l.cls === 'direct_equity')); assert.ok(Math.abs(r.lines.reduce((a, l) => a + l.amount, 0) - amt) < 1); }
});
