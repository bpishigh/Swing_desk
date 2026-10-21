import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replay } from '../src/pm/ledger.ts';
import { orderCharges } from '../src/pm/charges.ts';
import { taxView, fy } from '../src/pm/tax.ts';
import { assetType } from '../src/pm/classify.ts';
import type { Trade } from '../src/pm/reader.ts';
const charges = JSON.parse(readFileSync('data/rules/charges.json', 'utf8'));
const rules = JSON.parse(readFileSync('data/rules/tax.json', 'utf8'));
const T = (o: Partial<Trade>): Trade => ({ instrument: 'ABC', isin: 'INE000A01010', side: 'buy', qty: 1, price: 1, value: 1, date: '2025-01-10', time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock', ...o });
const buy = (date: string, qty: number, price: number, o: Partial<Trade> = {}) => T({ side: 'buy', date, qty, price, value: qty * price, ...o });
const sell = (date: string, qty: number, price: number, o: Partial<Trade> = {}) => T({ side: 'sell', date, qty, price, value: qty * price, ...o });

test('financial year boundaries', () => { assert.equal(fy('2025-03-31'), '2024-25'); assert.equal(fy('2025-04-01'), '2025-26'); });
test('Groww delivery buy of 10,000: brokerage 10, STT 10, stamp 1.50, GST on brokerage and levies', () => {
  const c = orderCharges(T({ value: 10000, qty: 100, price: 100 }), 'listed_equity', 'groww', charges);
  assert.equal(c.brokerage, 10); assert.equal(c.stt, 10); assert.equal(c.stamp, 1.5); assert.equal(c.gst, 1.86);
  assert.ok(c.deductible > 11 && c.deductible < 14 && !c.estimate); // STT excluded
});
test('brokerage is capped at 20 and floored at 5; Zerodha delivery brokerage is zero', () => {
  assert.equal(orderCharges(T({ value: 1000000 }), 'listed_equity', 'groww', charges).brokerage, 20);
  assert.equal(orderCharges(T({ value: 1000 }), 'listed_equity', 'groww', charges).brokerage, 5);
  assert.equal(orderCharges(T({ value: 1000000 }), 'listed_equity', 'zerodha', charges).brokerage, 0);
});
test('gold ETF has no STT; DP is charged once per sell day only', () => {
  assert.equal(orderCharges(T({ instrument: 'GLDETF', side: 'sell', value: 50000 }), 'gold_silver_etf', 'groww', charges).stt, 0);
  assert.equal(orderCharges(T({ side: 'sell', value: 5000 }), 'listed_equity', 'groww', charges, false).dp, 0);
});
test('asset type from name and kind; overrides win; unknown funds stay unclassified', () => {
  assert.equal(assetType({ instrument: 'SAMPLE GOLD ETF', isin: 'INF000A01011', kind: 'stock' }), 'gold_silver_etf');
  assert.equal(assetType({ instrument: 'Sample Flexi Cap Fund', isin: 'INF000F01027', kind: 'fund' }), 'fund_unclassified');
  assert.equal(assetType({ instrument: 'ABC', isin: 'INE000A01010', kind: 'stock' }), 'listed_equity');
  assert.equal(assetType({ instrument: 'X', isin: 'INF1', kind: 'fund' }, { INF1: 'gold_silver_etf' }), 'gold_silver_etf');
});
test('equity tax: ST at 20%, LT at 12.5% above 1.25 lakh, FY 2025-26', () => {
  const rep = replay([buy('2023-06-01', 100, 100), sell('2025-07-01', 100, 2100), buy('2025-05-01', 10, 100), sell('2025-08-01', 10, 200)]);
  const y = taxView(rep, () => 'listed_equity', () => 0, rules).find((x) => x.fy === '2025-26')!;
  assert.equal(y.equity.ltcg, 200000); assert.equal(y.equity.stcg, 1000);
  assert.equal(y.equity.exemptionUsed, 125000); assert.equal(y.equity.tax, Math.round(75000 * 0.125 + 1000 * 0.2));
});
test('short-term loss offsets long-term gain; long-term loss cannot offset short-term gain', () => {
  const Z = { instrument: 'ZZZ', isin: 'INE999Z01019' };
  const a = replay([buy('2025-04-10', 10, 100), sell('2025-06-01', 10, 50), buy('2023-01-01', 10, 100, Z), sell('2025-09-01', 10, 300, Z)]);
  const ya = taxView(a, () => 'listed_equity', () => 0, rules)[0];
  assert.equal(ya.equity.ltcgAfterSetoff, 2000 - 500);
  const b = replay([buy('2023-01-01', 10, 100), sell('2025-09-01', 10, 50), buy('2025-04-10', 10, 100, Z), sell('2025-06-01', 10, 300, Z)]);
  const yb = taxView(b, () => 'listed_equity', () => 0, rules)[0];
  assert.equal(yb.equity.taxable.stcg, 2000); assert.equal(yb.carryForward.ltcl, 500); assert.equal(yb.carryForward.unconfirmed, true);
});
test('open breaks raise a banner and stay out of totals; gold ETF gain goes to the slab pool, fund gain stays unlabelled', () => {
  const rep = replay([sell('2025-06-01', 5, 100), buy('2023-01-01', 10, 100, { instrument: 'GLDETF', isin: 'INF000A01011' }), sell('2025-06-02', 10, 150, { instrument: 'GLDETF', isin: 'INF000A01011' })]);
  const y = taxView(rep, (k) => (k === 'INF000A01011' ? 'gold_silver_etf' : 'listed_equity'), () => 0, rules)[0];
  assert.match(y.banner ?? '', /1 sell/); assert.equal(y.slabGains, 0 + 500 - 0 + 0 - 0 === 500 ? 500 : -1);
});
test('equity funds share the equity pool and exemption; debt fund bought after 1 Apr 2023 is short-term at any period; older debt lot needs 24 months', () => {
  const E = { instrument: 'EQF', isin: 'INF111', kind: 'fund' as const }, D = { instrument: 'DBT', isin: 'INF222', kind: 'fund' as const }, D2 = { instrument: 'DB2', isin: 'INF333', kind: 'fund' as const };
  const rep = replay([buy('2023-06-01', 100, 100, E), sell('2025-07-01', 100, 1350, E), buy('2023-06-01', 10, 100, { instrument: 'S', isin: 'INE5S' }), sell('2025-08-01', 10, 200, { instrument: 'S', isin: 'INE5S' }),
    buy('2023-05-01', 100, 10, D), sell('2025-07-02', 100, 12, D), buy('2022-05-01', 100, 10, D2), sell('2025-07-03', 100, 12, D2)]);
  const t = (k: string) => (k === 'INF111' ? 'equity_fund' : k === 'INF222' || k === 'INF333' ? 'debt_fund' : 'listed_equity') as any;
  const y = taxView(rep, t, () => 0, rules).find((x) => x.fy === '2025-26')!;
  assert.equal(y.equity.ltcg, 125000 + 1000);                                   // fund and share gains pooled
  const debt = y.lines.find((l) => l.type === 'debt_fund')!;
  assert.equal(debt.stcg, 200); assert.equal(debt.ltcg, 200);                    // bought 2023-05-01: deemed short-term; bought 2022: long-term after 24 months
});
