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
