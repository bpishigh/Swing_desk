import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoteOf } from '../src/pm/promote.ts';

const L = (sym: string, signalDate: string, stop = 90, stream = 'capwaived') => ({ sym, setup: '4', stream, trigger: 101, limit: 103, stop, signalDate });

test('a held name on the latest night is a Promote candidate with the line stop', () => {
  const r = promoteOf({ symbol: 'ABC', price: 100, qty: 50 }, [L('ABC', '2026-10-28')], '2026-10-28');
  assert.ok(r); assert.equal(r!.stop, 90); assert.equal(r!.riskPct, 10); assert.equal(r!.riskRs, 500); assert.equal(r!.qtyCapped, null);
});
test('an older night does not count', () => assert.equal(promoteOf({ symbol: 'ABC', price: 100, qty: 50 }, [L('ABC', '2026-10-23')], '2026-10-28'), null));
test('a stop at or above the price is not usable', () => assert.equal(promoteOf({ symbol: 'ABC', price: 100, qty: 50 }, [L('ABC', '2026-10-28', 100)], '2026-10-28'), null));
test('a risk budget caps the quantity', () => {
  const r = promoteOf({ symbol: 'ABC', price: 100, qty: 50 }, [L('ABC', '2026-10-28')], '2026-10-28', 300);
  assert.equal(r!.qtyCapped, 30);
});
test('no latest night, no result; capwaived line preferred', () => {
  assert.equal(promoteOf({ symbol: 'ABC', price: 100, qty: 50 }, [L('ABC', '2026-10-28')], undefined), null);
  const r = promoteOf({ symbol: 'ABC', price: 100, qty: 50 }, [L('ABC', '2026-10-28', 95, 'comparator'), L('ABC', '2026-10-28', 90)], '2026-10-28');
  assert.equal(r!.stop, 90);
});

import { sizePromote } from '../src/pm/promote.ts';
const acct = (o: object = {}) => ({ label: 'A', heldQty: 1000, swingCapital: 1_000_000, openRisk: 0, swingValueOfName: 0, inSwing: false, ...o });
const ctx = (o: object = {}) => ({ light: 'green' as const, maxPositions: 8, householdPositions: 0, householdOpenRisk: 0, ...o });

test('sizing is capped by one R of risk, then by what you hold', () => {
  const r = sizePromote({ price: 100, stop: 95, setup: '4' }, [acct()], ctx());
  assert.equal(r.perAccount[0].ok, true); assert.ok(r.perAccount[0].qty > 0 && r.perAccount[0].qty <= 1000);
  const small = sizePromote({ price: 100, stop: 95, setup: '4' }, [acct({ heldQty: 5 })], ctx());
  assert.equal(small.perAccount[0].qty, 5); assert.equal(small.perAccount[0].binding, 'the shares you hold');
});
test('no light, no sizing; no Legacy holding, no sizing', () => {
  assert.equal(sizePromote({ price: 100, stop: 95, setup: '4' }, [acct()], ctx({ light: null })).total, 0);
  assert.equal(sizePromote({ price: 100, stop: 95, setup: '4' }, [acct({ heldQty: 0 })], ctx()).perAccount[0].ok, false);
});
test('a full household position count blocks a new name but not one already in Swing', () => {
  assert.equal(sizePromote({ price: 100, stop: 95, setup: '4' }, [acct()], ctx({ householdPositions: 99 })).perAccount[0].ok, false);
  assert.equal(sizePromote({ price: 100, stop: 95, setup: '4' }, [acct({ inSwing: true })], ctx({ householdPositions: 99 })).perAccount[0].ok, true);
});
