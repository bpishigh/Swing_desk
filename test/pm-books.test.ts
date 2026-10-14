import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferBooks, bookTotals } from '../src/pm/books.ts';
import { valuationSeries } from '../src/pm/valuation.ts';
import type { Lot } from '../src/pm/ledger.ts';
import type { Trade } from '../src/pm/reader.ts';
const lot = (key: string, date: string, qty: number, unitCost: number): Lot => ({ key, date, qty, unitCost, source: {} as any });
const ctx = { typeOf: (k: string) => (k === 'GOLD' ? 'gold_silver_etf' : 'listed_equity') as any, isFund: (k: string) => k === 'FUND' };
test('funds and non-equity ETFs are Long-term; direct stocks are Legacy; every lot carries its rule', () => {
  const t = inferBooks([lot('FUND', '2024-01-01', 10, 10), lot('GOLD', '2024-01-01', 10, 10), lot('STK', '2024-01-01', 10, 10)], ctx);
  assert.deepEqual(t.map((x) => x.book), ['Long-term', 'Long-term', 'Legacy']); assert.ok(t.every((x) => x.rule.startsWith('rule')));
});
test('a lot is Swing only by promotion or by a shortlist match after go-live; before go-live nothing is Swing', () => {
  const l = lot('STK', '2026-11-05', 10, 10);
  assert.equal(inferBooks([l], { ...ctx, promoted: new Set(['STK|2026-11-05']) })[0].book, 'Swing');
  assert.equal(inferBooks([l], { ...ctx, swingGoLive: '2026-11-01', shortlistMatch: () => true })[0].book, 'Swing');
  assert.equal(inferBooks([l], { ...ctx, swingGoLive: null, shortlistMatch: () => true })[0].book, 'Legacy');
  assert.equal(inferBooks([lot('STK', '2026-10-30', 10, 10)], { ...ctx, swingGoLive: '2026-11-01', shortlistMatch: () => true })[0].book, 'Legacy');
});
test('book totals', () => { const tg = inferBooks([lot('STK', '2024-01-01', 10, 10)], ctx); assert.equal(bookTotals(tg, () => 12).Legacy.value, 120); });
test('valuation series: units from the replay times that day\'s price; a missing price carries forward and is counted', () => {
  const T = (side: 'buy' | 'sell', date: string, qty: number): Trade => ({ instrument: 'A', symbol: 'A', isin: 'A', side, qty, price: 100, value: qty * 100, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
  const prices: Record<string, number | undefined> = { '2024-01-02': 100, '2024-01-03': undefined, '2024-01-04': 120, '2024-01-05': 130 };
  const s = valuationSeries([T('buy', '2024-01-02', 10), T('sell', '2024-01-05', 4)], [], Object.keys(prices), (_k, d) => prices[d]);
  assert.deepEqual(s.map((x) => x.value), [1000, 1000, 1200, 780]); assert.deepEqual(s.map((x) => x.missingPrices), [0, 1, 0, 0]);
});
test('index ETFs are Long-term, like gold and international ETFs; a plain stock stays Legacy (owner, 14 Oct)', () => {
  const c = { ...ctx, isEtf: (k: string) => k === 'NIFTYBEES' };
  const t = inferBooks([lot('NIFTYBEES', '2024-01-01', 10, 10), lot('STK', '2024-01-01', 10, 10)], c);
  assert.deepEqual(t.map((x) => x.book), ['Long-term', 'Legacy']); assert.match(t[0].rule, /ETFs other than direct equity/);
});
