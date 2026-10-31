import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBhavcopy, parseNseDate, computeStocks, type BhavDay, type Row } from '../src/ingest/india-stocks.ts';

const HEAD = 'SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER';
const L = (s: string, ser: string, d: string, pc: number, c: number, v = 1000) => `${s}, ${ser}, ${d}, ${pc}, ${c - 1}, ${c + 2}, ${c - 2}, ${c}, ${c}, ${c}, ${v}, 10, 5, 400, 40.5`;

test('date shape', () => { assert.equal(parseNseDate('09-Oct-2026'), '2026-10-09'); assert.equal(parseNseDate('9-oct-2026'), '2026-10-09'); assert.equal(parseNseDate('x'), null); });

test('parse keeps EQ and BE, reads the date inside the file, prefers EQ', () => {
  const day = parseBhavcopy([HEAD, L('AAA', 'EQ', '09-Oct-2026', 10, 11), L('BBB', 'BE', '09-Oct-2026', 5, 6), L('CCC', 'N1', '09-Oct-2026', 5, 6), L('AAA', 'BE', '09-Oct-2026', 1, 2)].join('\n'));
  assert.equal(day.date, '2026-10-09');
  assert.deepEqual(Object.keys(day.rows).sort(), ['AAA', 'BBB']);
  assert.equal(day.rows.AAA[0], 'EQ'); assert.equal(day.rows.AAA[5], 11); assert.equal(day.rows.AAA[7], 40.5);
});
test('parse rejects mixed dates and empty files', () => {
  assert.throws(() => parseBhavcopy([HEAD, L('A', 'EQ', '08-Oct-2026', 1, 1), L('B', 'EQ', '09-Oct-2026', 1, 1)].join('\n')), /2 dates/);
  assert.throws(() => parseBhavcopy(HEAD), /no data rows/);
});

const mk = (n: number, f: (i: number) => { c: number; pc: number }): BhavDay[] => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); const { c, pc } = f(i);
  const row: Row = ['EQ', pc, c, c, c, c, 100 + i, null]; return { date: d, rows: { X: row } };
});

test('SMA runs through the session before D and needs the full window; EMA is warm only with history', () => {
  const days = mk(60, (i) => ({ c: 100 + i, pc: i ? 99 + i : 100 }));
  const st = computeStocks(days, days[59].date).X;
  assert.equal(st.sma50, 133.5);            // closes 109..158 dated before D
  assert.equal(st.sma200, undefined);
  assert.equal(st.maAsOf, days[58].date);
  assert.equal(st.emaAsOf, days[59].date);
  assert.equal(st.emaWarm, false);
  assert.ok(st.ema10! > st.ema20!);          // rising series: faster EMA is higher
  assert.deepEqual(st.adjusted, []);
});

test('a split (PREV_CLOSE far from the stored close) scales earlier closes so the average does not break', () => {
  // 100 flat at 200, then a 1:2 split: price 100, exchange PREV_CLOSE 100 on the event day
  const days = mk(61, (i) => (i < 60 ? { c: 200, pc: 200 } : { c: 100, pc: 100 }));
  const st = computeStocks(days, days[60].date).X;
  assert.equal(st.sma50, 100);
  assert.deepEqual(st.adjusted, [days[60].date]);
  assert.equal(st.close, 100);                 // today's close stays as traded
});

test('computeStocks needs sessions ending at D', () => {
  assert.throws(() => computeStocks(mk(3, () => ({ c: 1, pc: 1 })), '2030-01-01'), /must end at/);
});

test('no adjustment is made across a missing session', () => {
  const days = mk(61, (i) => (i < 60 ? { c: 200, pc: 200 } : { c: 100, pc: 100 }));
  const st = computeStocks(days, days[60].date, () => false).X;
  assert.deepEqual(st.adjusted, []);
});

test('a mismatch on most stocks at once is a missed session, not a corporate action', () => {
  const day = (date: string, pc: number, c: number): BhavDay => ({ date, rows: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`S${i}`, ['EQ', pc, c, c, c, c, 1, null] as Row])) });
  const days = [day('2026-02-02', 100, 100), day('2026-02-03', 90, 91)];   // pc 90 vs stored 100 for all thirty stocks
  assert.deepEqual(computeStocks(days, '2026-02-03').S3.adjusted, []);
});

test('a one-day move beyond the band is a break: averages straddling it are omitted, later windows are clean', () => {
  // flat 200 for 60 sessions, then 100 (a 1:2 split without any PREV_CLOSE help) and flat 100 for 60 more
  const days = mk(120, (i) => (i < 60 ? { c: 200, pc: 200 } : { c: 100, pc: i === 60 ? 200 : 100 }));
  const early = computeStocks(days.slice(0, 80), days[79].date).X;      // 20 closes after the break
  assert.deepEqual(early.breaks, [days[60].date]);
  assert.equal(early.sma50, undefined);                                    // the 50-close window crosses the break
  assert.equal(early.emaWarm, false);
  const late = computeStocks(days, days[119].date).X;                     // 59 closes after the break
  assert.equal(late.sma50, 100);                                           // window of 50 closes now starts after it
  assert.equal(late.sma200, undefined);
});

test('old-format daily file (to 2019): EQ and BE kept, one date, delivery share null', async () => {
  const { parseOldBhavcopy } = await import('../src/ingest/india-stocks.ts');
  const csv = 'SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN,\n'
    + '20MICRONS,EQ,40.75,41.5,39.15,41.05,41.1,40.75,5989,244540.9,15-JUN-2010,76,INE144J01027,\n'
    + 'ABAN,EQ,10,11,9,10.5,10.4,10,100,1000,15-JUN-2010,3,INE421A01028,\n'
    + 'ABAN,BE,1,1,1,1,1,1,1,1,15-JUN-2010,1,INE421A01028,\n'
    + 'GOLDBEES,GS,1,1,1,1,1,1,1,1,15-JUN-2010,1,INE000000000,\n';
  const d = parseOldBhavcopy(csv);
  assert.equal(d.date, '2010-06-15');
  assert.deepEqual(Object.keys(d.rows).sort(), ['20MICRONS', 'ABAN']);
  assert.deepEqual(d.rows['20MICRONS'], ['EQ', 40.75, 40.75, 41.5, 39.15, 41.05, 5989, null]);
  assert.equal(d.rows.ABAN[0], 'EQ');
  assert.throws(() => parseOldBhavcopy(csv.replace('15-JUN-2010,3', '16-JUN-2010,3')), /expected one/);
});
