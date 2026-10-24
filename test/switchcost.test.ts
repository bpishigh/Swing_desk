import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { switchCost } from '../src/pm/switchcost.ts';
import { planSales, type OpenLot } from '../src/pm/rebalance.ts';

const rules = JSON.parse(readFileSync('data/rules/tax.json', 'utf8'));
const today = '2026-10-24';
const fund = (o: Partial<OpenLot>): OpenLot => ({ name: 'F', kind: 'Fund', book: 'Long-term', assetClass: 'active_equity_fund', type: 'equity_fund', date: '2023-01-01', qty: 100, unitCost: 100, price: 200, ...o });

test('long-term equity fund: exemption used first, then 12.5%; net and break-even follow', () => {
  const c = switchCost([fund({ qty: 2000, unitCost: 100, price: 200 })], { today, rules, exemptionLeft: 125000 });
  assert.equal(c.value, 400000); assert.equal(c.gain, 200000); assert.equal(c.longGain, 200000);
  assert.ok(Math.abs((c.tax ?? -1) - 75000 * 0.125) < 1e-6);
  assert.ok(Math.abs(c.net - (400000 - 9375)) < 1e-6);
  assert.equal(c.breakEven.length, 3); assert.ok(c.breakEven[0].extra > c.breakEven[2].extra && c.breakEven[2].extra > 0);
});
test('loss lot pays no tax; a gain inside the usual exit window with no recorded load is flagged', () => {
  const l = switchCost([fund({ unitCost: 300 })], { today, rules });
  assert.equal(l.tax, 0);
  const f = switchCost([fund({ date: '2026-09-01', unitCost: 150 })], { today, rules });
  assert.ok(f.notes.some((n) => /no exit load is recorded/.test(n)));
  const r = switchCost([fund({ date: '2026-09-01', unitCost: 150, exitLoad: { days: 365, pct: 0.01 } })], { today, rules });
  assert.ok(Math.abs(r.load - 200) < 1e-9);
});
test('agrees with the rebalance sale plan on tax and load for the same lots', () => {
  const lots = [fund({ qty: 500, unitCost: 100, price: 250 }), fund({ date: '2026-03-01', qty: 300, unitCost: 200, price: 250, exitLoad: { days: 365, pct: 0.01 } })];
  const s = switchCost(lots, { today, rules, exemptionLeft: 125000 });
  const p = planSales(lots, { active_equity_fund: s.value }, { today, rules, exemptionLeft: 125000, settings: { minTrade: 1, maxCostShare: 10 } });
  assert.ok(Math.abs(p.taxTotal - (s.tax ?? 0)) < 1);
  assert.ok(Math.abs(p.lines.reduce((a, x) => a + x.load, 0) - s.load) < 1e-6);
});
