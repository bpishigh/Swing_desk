import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivePools, householdChecks, routeTrade, type PoolAccount } from '../src/pm/swingpools.ts';

const s = { maxPositions: 10, cashFunded: false };
const A = (label: string, owner: string, value: number, names: string[] = [], swingValue = 0): PoolAccount => ({ label, owner, value, swingValue, swingNames: names });

test('each account keeps its own money: swing capital comes from its own capital and profile', () => {
  const accts = [A('Pool1', 'B', 1_500_000, [], 100_000), A('Pool2', 'A', 500_000)];
  const rows = derivePools(accts, { Pool1: 0.25 * 1_500_000, Pool2: 0.05 * 500_000 });
  assert.equal(rows[0].swingCapital, 375_000); assert.equal(rows[0].room, 275_000); assert.equal(rows[1].swingCapital, 25_000);
  assert.deepEqual(derivePools([A('X', 'x', 0)], {}), [{ label: 'X', owner: 'x', swingCapital: 0, swingValue: 0, room: 0, positions: 0 }]);
});
test('household checks: one stock in one account; position cap across both', () => {
  const c = householdChecks([A('B', 'b', 1, ['X', 'Y']), A('A', 'a', 1, ['Y', 'Z'])], s);
  assert.equal(c.positions, 3); assert.deepEqual(c.duplicates, [{ name: 'Y', accounts: ['B', 'A'] }]); assert.equal(c.overCap, false);
  assert.equal(householdChecks([A('B', 'b', 1, Array.from({ length: 11 }, (_, i) => 'S' + i))], s).overCap, true);
});
test('routing: held stock stays; tax decides only with losses to absorb; else fewer positions; no room gives no account', () => {
  const accts = [A('B', 'b', 1_500_000, ['X', 'Y']), A('A', 'a', 500_000, ['Z'])], rows = derivePools(accts, { B: 225_000, A: 75_000 }), ctx = { s, stcgYtd: {}, taxRowConfident: true };
  assert.equal(routeTrade(accts, rows, 'X', ctx).account, 'B');
  const t = routeTrade(accts, rows, 'N', { ...ctx, stcgYtd: { a: -50000, b: 10000 } }); assert.equal(t.account, 'A'); assert.ok(t.steps.some((x) => /^tax: a has/.test(x)));
  const p = routeTrade(accts, rows, 'N', ctx); assert.equal(p.account, 'A'); assert.ok(p.steps.some((x) => /fewer open/.test(x)));
  assert.equal(routeTrade(accts, rows, 'N', { ...ctx, taxRowConfident: false }).account, 'A');
  const full = [A('B', 'b', 1_000, ['X'], 1_000_000)]; assert.equal(routeTrade(full, derivePools(full, { B: 1_000 }), 'N', ctx).account, null);
  const dup = [A('B', 'b', 1, ['X']), A('A', 'a', 1, ['X'])]; assert.equal(routeTrade(dup, derivePools(dup, { B: 100, A: 100 }), 'X', ctx).account, null);
});
test('transferred capital switches the tax step off', () => {
  const accts = [{ ...A('B', 'b', 1_000_000), capitalSource: 'transferred' as const }, A('A', 'a', 1_000_000)], rows = derivePools(accts, { B: 150_000, A: 150_000 });
  const r = routeTrade(accts, rows, 'N', { s, stcgYtd: { a: -90000, b: 0 }, taxRowConfident: true }); assert.ok(r.steps.some((x) => /tax step skipped/.test(x)));
});
