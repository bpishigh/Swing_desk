import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tradeHistory, type RawTxn } from '../src/pm/tradehistory.ts';
import type { Realised } from '../src/pm/ledger.ts';

const nm = (k: string) => ({ a: 'Alpha Industries Ltd', f: 'Beta Flexi Cap Fund' }[k] ?? k);
const kind = (k: string) => (k === 'f' ? 'Fund' as const : 'Stock' as const);
const book = (k: string) => (k === 'f' ? 'Long-term' : 'Legacy');
const rl = (key: string, sellDate: string, qty: number, gain: number): Realised => ({ key, buyDate: '2026-01-01', sellDate, qty, cost: 0, proceeds: 0, gain, days: 30, long: false });

test('every buy and sell appears, with stock summaries, status and the realised gain on each sale', () => {
  const raw: RawTxn[] = [
    { key: 'a', date: '2026-01-05', side: 'buy', qty: 10, price: 100 }, { key: 'a', date: '2026-02-10', side: 'sell', qty: 4, price: 120 },
    { key: 'a', date: '2026-03-10', side: 'sell', qty: 6, price: 90 }, { key: 'f', date: '2026-01-07', side: 'buy', qty: 5, price: 50 },
  ];
  const h = tradeHistory(raw, [rl('a', '2026-02-10', 4, 80), rl('a', '2026-03-10', 6, -60)], nm, kind, book, '2026-10-20', new Map([['f', 5]]));
  assert.equal(h.txns.length, 4);
  const a = h.stocks.find((s) => s.key === 'a')!, f = h.stocks.find((s) => s.key === 'f')!;
  assert.equal(a.status, 'Closed'); assert.equal(a.realised, 20); assert.equal(a.name, 'Alpha Industries Ltd');
  assert.equal(a.avgBuy, 100); assert.equal(Math.round(a.avgSell! * 100) / 100, 102);   // (480 + 540) / 10
  assert.equal(f.status, 'Open'); assert.equal(f.heldQty, 5); assert.equal(f.realised, 0);
  assert.equal(h.summary.closed, 1); assert.equal(h.summary.wins, 1);
  assert.deepEqual(h.months.map((m) => [m.ym, Math.round(m.realised)]), [['2026-01', 0], ['2026-02', 80], ['2026-03', -60]]);
});
test('two sales on one day at different prices get different gains that add to the replay figure; a part-sold stock is Partly sold; empty input is empty', () => {
  const raw: RawTxn[] = [{ key: 'a', date: '2026-01-05', side: 'buy', qty: 10, price: 100 }, { key: 'a', date: '2026-02-10', side: 'sell', qty: 2, price: 120 }, { key: 'a', date: '2026-02-10', side: 'sell', qty: 2, price: 125 }];
  const h = tradeHistory(raw, [rl('a', '2026-02-10', 4, 100)], nm, kind, book, '2026-10-20', new Map([['a', 6]]));
  assert.deepEqual(h.txns.filter((t) => t.side === 'sell').map((t) => Math.round(t.gain!)), [45, 55]);   // proceeds 490, cost 390, 195 each
  assert.equal(h.stocks[0].realised, 100);
  assert.equal(h.stocks[0].status, 'Partly sold');
  assert.equal(tradeHistory([], [], nm, kind, book, '2026-10-20').stocks.length, 0);
});

test('units held come from the replay, so a bonus or split does not make a stock look closed; unmatched stocks fall back to buys minus sells', () => {
  const raw: RawTxn[] = [{ key: 'a', date: '2026-01-05', side: 'buy', qty: 100, price: 100 }, { key: 'a', date: '2026-02-10', side: 'sell', qty: 100, price: 120 }, { key: 'f', date: '2026-01-07', side: 'buy', qty: 5, price: 50 }];
  // a 1:1 bonus gave 100 more shares, so 100 are still held although every bought share was sold
  const h = tradeHistory(raw, [rl('a', '2026-02-10', 100, 2000)], nm, kind, book, '2026-10-20', new Map([['a', 100]]));
  assert.equal(h.stocks.find((s) => s.key === 'a')!.status, 'Partly sold'); assert.equal(h.stocks.find((s) => s.key === 'a')!.heldQty, 100);
  assert.equal(h.stocks.find((s) => s.key === 'f')!.status, 'Open');   // not in the replay: buys minus sells
});
test('shares that arrived without a buy in the statements are flagged', () => {
  const h = tradeHistory([{ key: 'a', date: '2026-02-10', side: 'sell', qty: 5, price: 120 }], [rl('a', '2026-02-10', 5, 100)], nm, kind, book, '2026-10-20', new Map());
  assert.equal(h.stocks[0].noBuy, true); assert.equal(h.stocks[0].status, 'Closed');
});
