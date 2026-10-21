import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeOrders, openRiskOf, limitsFor, type OrderAcct } from '../src/pm/swingorders.ts';
import type { PoolRow } from '../src/pm/swingpools.ts';

const acct = (label: string, owner: string, o: Partial<OrderAcct> = {}): OrderAcct => ({ label, owner, value: 1e6, swingValue: 0, swingNames: [], openRisk: 0, stopsMissing: [], blocked: [], ...o });
const row = (label: string, owner: string, swingCapital: number, positions = 0): PoolRow => ({ label, owner, swingCapital, swingValue: 0, room: swingCapital, positions });
const ctx = { light: 'green' as const, vix: 14, s: { maxPositions: 10, cashFunded: false }, stcgYtd: {}, taxRowConfident: true };
const cand = { sym: 'AAA', name: 'AAA Ltd', setup: '1' as const, trigger: 1005, stop: 940 };

test('limits: Red light and VIX above 20 halve risk', () => {
  assert.equal(limitsFor('green', 14)!.risk, 0.5);
  assert.equal(limitsFor('green', 22)!.risk, 0.25);
  assert.equal(limitsFor(null), null);
});
test('each account is sized on its own capital', () => {
  const o = sizeOrders([cand], [acct('A', 'Person2'), acct('B', 'Person1')], [row('A', 'Person2', 100000), row('B', 'Person1', 400000)], ctx);
  const [a, b] = o.lines[0].perAccount;
  assert.ok(b.qty > a.qty, 'larger capital gets a larger size');
  assert.ok(a.qty * 65 <= 100000 * 0.005 + 65, 'risk within one R');
});
test('position cap binds on a wide-capital, tight-stop trade', () => {
  const o = sizeOrders([{ ...cand, stop: 1000 }], [acct('A', 'Person2')], [row('A', 'Person2', 1e6)], ctx);
  assert.equal(o.lines[0].perAccount[0].binding, '20% position cap');
});
test('open-risk limit binds when the account has little headroom', () => {
  const o = sizeOrders([cand], [acct('A', 'Person2', { openRisk: 4900 })], [row('A', 'Person2', 100000)], { ...ctx, light: 'yellow' });
  const l = o.lines[0].perAccount[0];
  assert.ok(l.binding.includes('open-risk'), l.binding);
  assert.equal(l.qty, 0);
});
test('blocked name, disallowed setup and full book give no order', () => {
  const blocked = sizeOrders([cand], [acct('A', 'Person2', { blocked: ['AAA Ltd'] })], [row('A', 'Person2', 1e6)], ctx);
  assert.equal(blocked.lines[0].account, null);
  const red = sizeOrders([{ ...cand, setup: '2' }], [acct('A', 'Person2')], [row('A', 'Person2', 1e6)], { ...ctx, light: 'red' });
  assert.equal(red.lines[0].account, null);
  const full = sizeOrders([cand], [acct('A', 'Person2', { swingNames: Array.from({ length: 10 }, (_, i) => 'N' + i) })], [row('A', 'Person2', 1e6, 10)], ctx);
  assert.equal(full.lines[0].account, null);
});
test('a stock already held stays in its account; two new trades respect the household count', () => {
  const o = sizeOrders([cand], [acct('A', 'Person2', { swingNames: ['AAA Ltd'] }), acct('B', 'Person1')], [row('A', 'Person2', 1e6, 1), row('B', 'Person1', 1e6)], ctx);
  assert.equal(o.lines[0].account, 'A');
  const many = ['x', 'y', 'z'].map((s) => ({ ...cand, sym: s, name: s }));
  const r = sizeOrders(many, [acct('A', 'Person2'), acct('B', 'Person1')], [row('A', 'Person2', 1e6), row('B', 'Person1', 1e6)], { ...ctx, light: 'red' });
  assert.equal(r.lines.filter((l) => l.account).length, 2, 'Red allows two positions');
});
test('household open risk is shared across accounts', () => {
  const o = sizeOrders([cand], [acct('A', 'Person2', { openRisk: 0 }), acct('B', 'Person1', { openRisk: 24000 })], [row('A', 'Person2', 500000), row('B', 'Person1', 500000)], { ...ctx, light: 'yellow' });
  assert.equal(o.householdCapRs, 25000);
  const total = o.lines[0].perAccount.map((p) => p.qty * o.lines[0].rps);
  assert.ok(Math.min(...total) <= 1000 + 1e-6);
});
test('open risk from lots and stops; missing stops are listed', () => {
  const lots = [{ name: 'X', book: 'Swing', qty: 100, unitCost: 500 }, { name: 'Y', book: 'Swing', qty: 10, unitCost: 100 }, { name: 'Z', book: 'Legacy', qty: 5, unitCost: 1 }];
  const r = openRiskOf(lots, { X: 480 });
  assert.equal(r.openRisk, 2000); assert.deepEqual(r.stopsMissing, ['Y']);
  assert.equal(openRiskOf(lots, { X: 520, Y: 90 }).openRisk, 100);
});
test('a stop from the recognised shortlist line is used unless one is typed', () => {
  const lots = [{ name: 'X', book: 'Swing', qty: 100, unitCost: 500, stop: 490 }, { name: 'Y', book: 'Swing', qty: 10, unitCost: 100 }];
  assert.equal(openRiskOf(lots).openRisk, 1000); assert.deepEqual(openRiskOf(lots).stopsMissing, ['Y']);
  assert.equal(openRiskOf(lots, { X: 480 }).openRisk, 2000);
});

test('within a night, an account that has taken a trade is not given the next one past its own limits', () => {
  // Yellow light: open-risk cap 2.5% of 100,000 = 2,500; account A already carries 1,500; B is empty with the same capital.
  const cands = ['p', 'q', 'r', 's'].map((x) => ({ ...cand, sym: x, name: x }));
  const o = sizeOrders(cands, [acct('A', 'Person2', { openRisk: 1500 }), acct('B', 'Person1')], [row('A', 'Person2', 100000), row('B', 'Person1', 100000)], { ...ctx, light: 'yellow' });
  const riskA = o.lines.filter((l) => l.account === 'A').reduce((t, l) => t + l.perAccount.find((p) => p.label === 'A')!.qty * l.rps, 0);
  assert.ok(1500 + riskA <= 2500 + 1e-6, 'A stays inside its open-risk cap: ' + riskA);
  assert.ok(o.lines.some((l) => l.account === 'B'), 'the empty account B takes some');
});
test('the 20% position cap counts what the account already holds in that name', () => {
  const o = sizeOrders([{ ...cand, stop: 1000 }], [acct('A', 'Person2', { swingNames: ['AAA Ltd'], heldValue: { 'AAA Ltd': 190000 } })], [row('A', 'Person2', 1e6, 1)], ctx);
  const l = o.lines[0].perAccount[0];
  assert.ok(l.qty * 1005 + 190000 <= 200000 + 1005, 'position stays near 20%: ' + l.qty);
});

test('a stop wider than the setup maximum after the ATR floor is skipped, not resized; two new names a night at most; adds do not count', () => {
  const wide = sizeOrders([{ ...cand, stop: 700 }], [acct('A', 'Person2')], [row('A', 'Person2', 1e6)], ctx);
  assert.equal(wide.lines[0].account, null); assert.match(wide.lines[0].perAccount[0].note ?? '', /over the .*% limit/);
  const mk = (sym: string) => ({ ...cand, sym, name: sym + ' Ltd' });
  const three = sizeOrders([mk('AAA'), mk('BBB'), mk('CCC')], [acct('A', 'Person2')], [row('A', 'Person2', 1e6)], ctx);
  assert.deepEqual(three.lines.map((l) => l.account), ['A', 'A', null]); assert.match(three.lines[2].perAccount[0].note ?? '', /two new entries/);
  const held = sizeOrders([mk('AAA'), mk('BBB'), mk('CCC')], [acct('A', 'Person2', { swingNames: ['CCC Ltd'] })], [row('A', 'Person2', 1e6, 1)], ctx);
  assert.ok(held.lines[2].perAccount[0].note !== 'the limit of two new entries a day is used');   // CCC is already held: an add
});
