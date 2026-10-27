import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harvest, saleAfter, type EqLot } from '../src/pm/harvest.ts';
import { scoreEntry, addMonths } from '../src/pm/scoring.ts';

const rate = { stcg: 0.2, ltcg: 0.125 };
const lot = (o: Partial<EqLot> = {}): EqLot => ({ name: 'X', date: '2026-01-01', qty: 100, unitCost: 1000, price: 800, long: false, daysToLong: 100, ...o });

test('a loss that cancels real gains is worth booking', () => {
  const r = harvest([lot()], { stcg: 20000, ltcgTaxable: 0 }, rate, () => 20)[0];   // loss 20,000 against 20,000 short-term gain
  assert.equal(Math.round(r.taxSaved), 4000); assert.equal(r.fire, true);
});
test('with no gains the loss is counted at half and small ones do not fire', () => {
  const r = harvest([lot({ qty: 5 })], { stcg: 0, ltcgTaxable: 0 }, rate, () => 20)[0];   // loss 1,000, carry value 1,000 x 50% x 12.5% = 62.5; round trip 40 + 0.5% of 4,000 = 60
  assert.equal(Math.round(r.carryValue), 63); assert.equal(r.fire, false);
});
test('a long-term loss cannot cancel short-term gains', () => {
  const r = harvest([lot({ long: true })], { stcg: 50000, ltcgTaxable: 0 }, rate, () => 20)[0];
  assert.equal(r.taxSaved, 0);
});
test('wait for the long-term date only when the saving clearly beats the risk', () => {
  const l = lot({ price: 1500, daysToLong: 30 });   // gain 50,000
  const r = saleAfter([l], '2026-10-27', 0, rate, () => 0.015)[0];   // saves 50,000 x 7.5% = 3,750; risk 150,000 x 1.5% x sqrt(30) = 12,300
  assert.equal(r.wait, false);
  const q = saleAfter([l], '2026-10-27', 125000, rate, () => 0.002)[0];   // exemption covers the gain: saves 10,000; risk about 1,600
  assert.equal(q.wait, true);
});

test('scoring: Exit is right when the stock stays near or below its price; future follow-ups are pending', () => {
  const f = { priceAt: (_s: string, d: string) => (d === '2026-01-01' ? 100 : 90), benchAt: () => 1, keepReturn: () => 0.1 };
  const e = { date: '2026-01-01', symbol: 'A', verdict: 'Exit', close: 100 };
  assert.equal(scoreEntry(e, 3, '2026-10-01', f).right, true);
  assert.equal(scoreEntry(e, 12, '2026-10-01', f).status, 'pending');
  assert.equal(scoreEntry({ ...e, verdict: 'Trim' }, 3, '2026-10-01', f).right, true);   // -10% vs +10% for Keep names
  assert.equal(scoreEntry({ ...e, verdict: 'Harvest' }, 3, '2026-10-01', f).status, 'manual');
  assert.equal(addMonths('2026-01-31', 1), '2026-03-03');
});
