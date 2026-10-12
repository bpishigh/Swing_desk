import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeDividends, perShareAmount } from '../src/pm/dividends.ts';
import { Lineage } from '../src/pm/lineage.ts';
import type { Trade } from '../src/pm/reader.ts';
const rules = JSON.parse(readFileSync('data/rules/dividend.json', 'utf8'));
const T = (side: 'buy' | 'sell', date: string, qty: number): Trade => ({ instrument: 'ABC', symbol: 'ABC', isin: 'INE000A01010', side, qty, price: 100, value: qty * 100, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
const lin = new Lineage(); lin.link('ABC', 'INE000A01010', '2024-01-01');
const row = (exDate: string, subject: string) => ({ symbol: 'ABC', subject, exDate, isin: 'INE000A01010' });

test('amount per share is read from the subject, including Re and combined wording', () => {
  assert.equal(perShareAmount('Interim Dividend - Rs 6.50 Per Share'), 6.5);
  assert.equal(perShareAmount('Dividend - Re 1 Per Share'), 1);
  assert.equal(perShareAmount('Annual General Meeting/Dividend - Rs 12.5 Per Share'), 12.5);
  assert.equal(perShareAmount('Bonus 1:2'), null);
});
test('entitlement is units held at the close before the ex-date: a buy on the ex-date earns nothing, a sell on it still earns', () => {
  const trades = [T('buy', '2024-05-01', 100), T('buy', '2024-06-10', 50), T('sell', '2024-06-10', 100)];
  const y = computeDividends(trades, [], [row('2024-06-10', 'Dividend - Rs 10 Per Share')], lin, rules);
  assert.equal(y[0].lines[0].units, 100); assert.equal(y[0].gross, 1000); assert.equal(y[0].tds, 0);                    // under the 5,000 threshold: no TDS
});
test('TDS at 10% on the whole year once one company passes 5,000; a stock sold before the ex-date gets nothing', () => {
  const trades = [T('buy', '2024-05-01', 1000)];
  const y = computeDividends(trades, [], [row('2024-06-10', 'Dividend - Rs 4 Per Share'), row('2024-11-10', 'Interim Dividend - Rs 3 Per Share')], lin, rules);
  assert.equal(y[0].gross, 7000); assert.equal(y[0].tds, 700); assert.equal(y[0].net, 6300);
  const none = computeDividends([T('buy', '2024-05-01', 10), T('sell', '2024-06-09', 10)], [], [row('2024-06-10', 'Dividend - Rs 4 Per Share')], lin, rules);
  assert.equal(none.length, 0);
});
test('a bonus before the ex-date raises the units that earn the dividend', () => {
  const trades = [T('buy', '2024-05-01', 100)];
  const ev = [{ type: 'bonus' as const, key: 'INE000A01010', num: 1, den: 1, date: '2024-06-01', source: 'x' }];
  assert.equal(computeDividends(trades, ev, [row('2024-06-10', 'Dividend - Rs 2 Per Share')], lin, rules)[0].gross, 400);
});
