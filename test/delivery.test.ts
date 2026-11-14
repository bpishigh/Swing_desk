import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFullBhav, parseMto, deliveryPct } from '../src/ingest/delivery.ts';
test('full bhavcopy: keeps EQ, BE and BZ, reads the date, treats a dash delivery as missing', () => {
  const csv = 'SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER\nAAA, EQ, 13-Nov-2026, 1, 1, 1, 1, 1, 1, 1, 1000, 1, 5, 600, 60.00\nBBB, BE, 13-Nov-2026, 1, 1, 1, 1, 1, 1, 1, 200, 1, 5, 200, 100.00\nCCC, N1, 13-Nov-2026, 1, 1, 1, 1, 1, 1, 1, 50, 1, 5, 10, 20\nDDD, EQ, 13-Nov-2026, 1, 1, 1, 1, 1, 1, 1, 100, 1, 5, -, -\n';
  const r = parseFullBhav(csv); assert.equal(r.date, '2026-11-13'); assert.deepEqual(r.rows.map((x) => x[0]), ['AAA', 'BBB']); assert.equal(r.bad, 1);
  assert.equal(deliveryPct(r.rows[0]), 60);
});
test('MTO: record lines only, series filter', () => {
  const t = 'Security Wise Delivery Position - Compulsory Rolling Settlement\n10,MTO,10062019,450676724,0001756\nTrade Date<DDMMYYYY>,Total,Deliv\n20,1,AAA,EQ,1000,250,25.00\n20,2,BBB,N1,500,100,20.00\n20,3,CCC,BZ,300,300,100.00\n';
  const r = parseMto(t); assert.deepEqual(r.rows, [['AAA', 'EQ', 1000, 250], ['CCC', 'BZ', 300, 300]]);
});
test('delivery percent is null when nothing traded', () => { assert.equal(deliveryPct(['X', 'EQ', 0, 0]), null); });
