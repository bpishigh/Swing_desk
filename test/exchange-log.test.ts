import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeals, parseSurveillance, isoOf } from '../src/ingest/exchange-log.ts';
test('deals: parses the exchange CSV, keeps quoted commas, counts bad rows', () => {
  const csv = 'Date,Symbol,Security Name,Client Name,Buy/Sell,Quantity Traded,Trade Price / Wght. Avg. Price,Remarks\n13-NOV-2026,ABC,ABC Ltd,"X FUND, SERIES 2",BUY,"1,200,000",101.5,-\n13-NOV-2026,ABC,ABC Ltd,Y TRADING LLP,SELL,500,100,-\nbad row\n';
  const r = parseDeals(csv); assert.equal(r.rows.length, 2); assert.equal(r.bad, 1);
  assert.equal(r.rows[0].client, 'X FUND, SERIES 2'); assert.equal(r.rows[0].units, 1200000); assert.equal(r.rows[0].date, '2026-11-13'); assert.equal(r.rows[1].side, 'SELL');
});
test('dates: day-month-year with month names', () => { assert.equal(isoOf('3-Feb-2026'), '2026-02-03'); assert.equal(isoOf('13-NOV-2026'), '2026-11-13'); assert.equal(isoOf('2026-11-13'), null); });
test('surveillance: arrays, wrapped data, and missing parts', () => {
  const r = parseSurveillance({ longterm: { data: [{ a: 1 }] }, shortterm: [{ a: 2 }, { a: 3 }] }, [{ isin: 'X' }], null);
  assert.equal(r.asmLong.length, 1); assert.equal(r.asmShort.length, 2); assert.equal(r.gsm.length, 1); assert.equal(r.esm.length, 0);
});
