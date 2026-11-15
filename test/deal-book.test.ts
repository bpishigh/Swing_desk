import test from 'node:test';
import assert from 'node:assert/strict';
import { dealBook, roundTrippers, type DealRow } from '../src/engine/batch-c.ts';
import { newBook } from '../src/engine/stock-book.ts';
const dates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16'];
const row = (date: string, symbol: string, client: string, side: string, units: number, price: number): DealRow => ({ kind: 'bulk', date, symbol, name: symbol, client, side, units, price, remarks: '-' });
const flat = (n: number) => Float64Array.from({ length: n }, (_, i) => 100 + (i % 2));
const mkx = (t: number) => ({ el: [{ sym: 'AAA', value: 1e9 }, { sym: 'BBB', value: 1e9 }], series: new Map([['AAA', { c: flat(60), h: flat(60).map((v) => v + 1), l: flat(60).map((v) => v - 1) }], ['BBB', { c: flat(60), h: flat(60).map((v) => v + 1), l: flat(60).map((v) => v - 1) }]]), t, dates, held: new Set<string>(), fund: {}, st: newBook('x', '2026-11-01') });
const T = 40, ds = Array.from({ length: 60 }, (_, i) => `2026-0${1 + Math.floor(i / 30)}-${String(1 + (i % 30)).padStart(2, '0')}`);
test('a plain Rs 10 crore buy is taken; small and keyword rows are not', () => {
  const x = { ...mkx(T), dates: ds }, D = ds[T];
  const rows = [row(D, 'AAA', 'RAVI KUMAR', 'BUY', 200000, 600), row(D, 'BBB', 'XYZ SECURITIES LTD', 'BUY', 200000, 600), row(D, 'AAA', 'SMALL HOLDER', 'BUY', 100, 600)];
  const log: never[] = []; const o = dealBook(x as never, { log: rows, open: () => 100 }, rows, log as never)!;
  assert.deepEqual(o.buys.map((b) => b.sym), ['AAA']);
  assert.ok((log as unknown as Array<{ why: string }>).some((l) => l.why.startsWith('keyword')));
});
test('a client who sold the same stock within 5 sessions is excluded as a round trip', () => {
  const x = { ...mkx(T), dates: ds }, D = ds[T], rows = [row(ds[T - 2], 'AAA', 'RAVI KUMAR', 'SELL', 200000, 600), row(D, 'AAA', 'RAVI KUMAR', 'BUY', 200000, 600)];
  assert.equal(dealBook(x as never, { log: rows, open: () => 100 }, [rows[1]])?.buys.length ?? 0, 0);
  assert.ok(roundTrippers(rows, ds, D).has('RAVI KUMAR'));
});
test('a fund buyer is tagged, not excluded', () => {
  const x = { ...mkx(T), dates: ds }, D = ds[T], rows = [row(D, 'AAA', 'HDFC MUTUAL FUND - EQUITY', 'BUY', 200000, 600)], log: Array<{ buyer: string }> = [];
  assert.equal(dealBook(x as never, { log: rows, open: () => 100 }, rows, log as never)!.buys.length, 1); assert.equal(log[0].buyer, 'fund');
});
void dates;
