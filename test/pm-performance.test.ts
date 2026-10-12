import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xirr, performance } from '../src/pm/performance.ts';
test('xirr: 100 in, 110 out a year later is 10%', () => { assert.ok(Math.abs(xirr([{ date: '2024-01-01', amount: -100 }, { date: '2024-12-31', amount: 110 }])! - 0.1) < 0.002); });
test('xirr: two instalments, uneven timing', () => {
  const r = xirr([{ date: '2024-01-01', amount: -100 }, { date: '2024-07-01', amount: -100 }, { date: '2025-01-01', amount: 230 }])!;
  const f = (x: number) => -100 - 100 / Math.pow(1 + x, 182 / 365) + 230 / Math.pow(1 + x, 366 / 365); assert.ok(Math.abs(f(r)) < 0.01);
});
test('xirr is undefined with no gain or loss side, or a single flow', () => { assert.equal(xirr([{ date: '2024-01-01', amount: -100 }]), null); assert.equal(xirr([{ date: '2024-01-01', amount: -100 }, { date: '2024-06-01', amount: -50 }]), null); });
test('a total loss and a negative return are handled', () => { assert.ok(xirr([{ date: '2024-01-01', amount: -100 }, { date: '2025-01-01', amount: 50 }])! < -0.45); });
test('dividends raise the return; charges lower it; held value counts as a closing flow', () => {
  const base = { orders: [{ date: '2024-01-01', side: 'buy' as const, value: 1000 }], holdingsValue: 1100, asOf: '2025-01-01' };
  const p0 = performance(base), p1 = performance({ ...base, dividends: [{ date: '2024-09-01', net: 40 }] }), p2 = performance({ ...base, orders: [{ ...base.orders[0], charges: 10 }] });
  assert.ok(p1.xirrWithDividends! > p0.xirrPriceOnly!); assert.ok(p2.xirrPriceOnly! < p0.xirrPriceOnly!); assert.equal(p0.gain, 100);
});
