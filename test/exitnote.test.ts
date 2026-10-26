import { test } from 'node:test'; import assert from 'node:assert/strict';
import { parseExitNote } from '../src/pm/exitnote.ts';
import { loadRate } from '../src/pm/rebalance.ts';
test('single tier with a free share', () => {
  const l = parseExitNote('Exit Load for units in excess of 10% of the investment,1% will be charged for redemption within 1 year.').load!;
  assert.equal(l.pct, 0.01); assert.equal(l.free, 0.1); assert.equal(l.days, 366);
  assert.ok(Math.abs(loadRate(l, 100) - 0.009) < 1e-9); assert.equal(loadRate(l, 400), 0);
});
test('months, days and trailing line breaks', () => {
  assert.equal(parseExitNote('Exit load of 1% for investments beyond 10% if redeemed within 12 months').load!.free, 0.1);
  assert.equal(parseExitNote('Exit load of 1%, if redeemed within 365 days.\r\n').load!.days, 366);
  assert.equal(parseExitNote('Exit load of 1% if redeemed within 15 days').load!.days, 16);
});
test('two tiers (Parag Parikh wording, cut short)', () => {
  const l = parseExitNote('For units above 10% of the investment, exit load of 2% if redeemed within 365 days and 1% if redeemed after 365 days but').load!;
  assert.equal(l.pct, 0.02); assert.equal(l.free, 0.1);
  const l2 = parseExitNote('2% if redeemed within 365 days and 1% if redeemed after 365 days but within 730 days').load!;
  assert.deepEqual(l2.tiers, [{ days: 366, pct: 0.02 }, { days: 731, pct: 0.01 }]);
});
test('graded liquid schedule, even when the page cuts it short', () => {
  const l = parseExitNote('Exit load of 0.0070% if redeemed within 1 day, 0.0065% if redeemed within 2 days, 0.0060% if redeemed within 3 days, 0.0').load!;
  assert.equal(l.tiers!.length, 6); assert.equal(l.tiers![5].pct, 0.000045);
});
test('nothing understood returns null', () => {
  assert.equal(parseExitNote('Exit load applicable as per SID').load, null); assert.equal(parseExitNote('').load, null);
  assert.deepEqual(parseExitNote('Nil').load, { days: 0, pct: 0 });
});
test('the free share is not read as the charge, and typos are tolerated', () => {
  const l = parseExitNote('Exit load of 1% for investments beyond 10% if redeemed within 12 months').load!;
  assert.equal(l.pct, 0.01); assert.equal(l.free, 0.1);
  assert.equal(parseExitNote('Exit load of 0.50% if redeemed witihin 3 months.').load!.pct, 0.005);
});
