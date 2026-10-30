import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseCsv } from '../src/pm/csv.ts';
import { readXlsx } from '../src/pm/xlsx.ts';
import { readRows, readSheets, detectBroker, mergeTrades, aggregateFills, accountAlias, parseDateColumn } from '../src/pm/reader.ts';
import { replay } from '../src/pm/ledger.ts';

const kite = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
ABC,INE000A01010,2024-01-10,NSE,EQ,EQ,buy,FALSE,60,100,1,O1,2024-01-10 09:20:00
ABC,INE000A01010,2024-01-10,NSE,EQ,EQ,buy,FALSE,40,110,2,O1,2024-01-10 09:20:05
ABC,INE000A01010,2025-02-11,NSE,EQ,EQ,sell,FALSE,50,150,3,O2,2025-02-11 10:00:00
`;
test('Zerodha-style tradebook: fills of one order aggregate, FIFO gain and holding period', () => {
  const r = readRows(parseCsv(kite));
  assert.equal(r.trades.length, 3); assert.equal(r.confidence, 'high');
  const orders = aggregateFills(r.trades);
  assert.equal(orders.length, 2); assert.equal(orders[0].qty, 100); assert.equal(orders[0].price, 104);
  const p = replay(orders);
  assert.equal(p.realised[0].gain, 50 * (150 - 104)); assert.equal(p.realised[0].long, true);
  assert.equal(p.open[0].qty, 50); assert.equal(p.breaks.length, 0);
});

const grow = `Name,Test Person,,,
Unique Client Code,1234567890,,,
,,,,
Order history for stocks from 01-04-2021 to 30-06-2026,,,,
,,,,
Stock name,Symbol,ISIN,Type,Quantity,Value,Exchange,Exchange Order Id,Execution date and time,Order status
SAMPLE ETF,SMPLETF,INF000A01011,BUY,10,1000,NSE,111,05-02-2025 10:06 AM,Executed
SAMPLE ETF,SMPLETF,INF000A01011,SELL,10,1100,BSE,112,17-02-2025 01:30 PM,Executed
SAMPLE ETF,SMPLETF,INF000A01011,BUY,5,500,NSE,113,18-02-2025 09:30 AM,Rejected
`;
test('preamble skipped and read as identity, value-only file gets a price, day-first settled by a day above 12, rejected orders skipped', () => {
  const r = readRows(parseCsv(grow));
  assert.equal(r.profile.headerRow, 4); assert.equal(r.trades.length, 2);
  assert.equal(r.trades[0].price, 100); assert.equal(r.trades[0].date, '2025-02-05'); assert.equal(r.trades[1].time, '13:30:00');
  assert.equal(r.identity.clientCode, '1234567890'); assert.equal(r.identity.name, 'Test Person');
});
test('month-first column settled by whole-column evidence, and by sort order when values do not settle it', () => {
  assert.deepEqual(parseDateColumn(['03/25/2024', '04/02/2024']).iso, ['2024-03-25', '2024-04-02']);
  const amb = parseDateColumn(['01/02/2024', '02/03/2024', '03/04/2024']);
  assert.equal(amb.iso[0], '2024-02-01'); assert.match(amb.format, /assumed/); // undecided: Indian default, flagged
  assert.deepEqual(parseDateColumn(['05/04/2024', '03/04/2024']).iso, ['2024-04-05', '2024-04-03']); // descending: day-first keeps it sorted
  assert.deepEqual(parseDateColumn(['01/02/2024', '02/01/2024', '03/01/2024']).iso, ['2024-01-02', '2024-02-01', '2024-03-01']); // only month-first keeps it sorted
  assert.equal(parseDateColumn(['25/03/2024', '03/25/2024']).format, 'ambiguous');
});
test('renamed and reordered columns, other delimiter, serial dates, buy/sell words', () => {
  const t = 'Scrip;Purchase/Sale;Net Amount;Qty;Rate;Trade Date\nXYZ LTD;B;2000;20;100;45292\nXYZ LTD;S;2200;20;110;45300\n';
  const r = readRows(parseCsv(t));
  assert.equal(r.trades.length, 2); assert.equal(r.trades[0].date, '2024-01-01'); assert.equal(r.trades[1].side, 'sell');
});
test('invariant failure is reported with row and reason, not accepted', () => {
  const t = 'symbol,trade_type,quantity,price,value,date\nA,buy,10,100,5000,2024-01-01\nA,buy,10,100,1000,2024-01-02\n';
  const r = readRows(parseCsv(t));
  assert.equal(r.trades.length, 1); assert.match(r.issues[0].reason, /does not match value/); assert.equal(r.issues[0].row, 2);
});
test('a file with no quantity column is refused with a message', () => {
  assert.match(readRows(parseCsv('a,b,c\n1,2,3\n')).rejected ?? '', /header/i);
});
test('a sell with no buy is a break, never an invented cost', () => {
  const r = readRows(parseCsv('symbol,isin,trade_type,quantity,price,trade_date,exchange\nQ,INE111A01011,sell,5,10,2024-05-05,NSE\n'));
  const p = replay(r.trades); assert.equal(p.breaks[0].qty, 5); assert.equal(p.realised.length, 0);
});
test('merge by trade id makes re-upload harmless; alias is salted and stable', () => {
  const a = readRows(parseCsv(kite)).trades;
  assert.equal(mergeTrades([a, a]).duplicates, 3);
  assert.equal(accountAlias('ZX1234', 's1'), accountAlias(' zx1234', 's1')); assert.notEqual(accountAlias('ZX1234', 's1'), accountAlias('ZX1234', 's2'));
});

function xlsxFile(sheetXml: string, shared: string[]): Uint8Array {
  const files: [string, string][] = [
    ['xl/workbook.xml', '<workbook><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/sharedStrings.xml', '<sst>' + shared.map((s) => `<si><t>${s}</t></si>`).join('') + '</sst>'],
    ['xl/worksheets/sheet1.xml', sheetXml],
  ];
  const parts: Buffer[] = [], dir: Buffer[] = []; let off = 0;
  for (const [name, text] of files) {
    const data = deflateRawSync(Buffer.from(text)), nb = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(text.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(text.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); dir.push(ch, nb); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}
test('xlsx: shared strings, numbers, preamble, skipped empty cells; read through the same pipeline', () => {
  const s = ['Scheme Name', 'Type', 'Units', 'NAV', 'Amount', 'Date', 'Fund A', 'Purchase', '12 Jan 2024', 'Report'];
  const row = (n: number, cells: string) => `<row r="${n}">${cells}</row>`;
  const sheet = '<worksheet><sheetData>' + row(1, '<c r="A1" t="s"><v>9</v></c>') +
    row(3, ['A', 'B', 'C', 'D', 'E', 'F'].map((c, i) => `<c r="${c}3" t="s"><v>${i}</v></c>`).join('')) +
    row(4, '<c r="A4" t="s"><v>6</v></c><c r="B4" t="s"><v>7</v></c><c r="C4"><v>10</v></c><c r="D4"><v>25</v></c><c r="E4"><v>250</v></c><c r="F4" t="s"><v>8</v></c>') +
    '</sheetData></worksheet>';
  const sheets = readXlsx(xlsxFile(sheet, s));
  const r = readRows(sheets[0].rows);
  assert.equal(r.trades.length, 1); assert.equal(r.trades[0].date, '2024-01-12'); assert.equal(r.trades[0].kind, 'fund'); assert.equal(r.trades[0].price, 25);
});

test('J10: every sheet of a workbook is read, a non-tradebook sheet is skipped, and the broker comes from the columns', () => {
  const kiteRows = parseCsv(kite), grow = parseCsv(`Stock name,ISIN,Quantity,Value,Exchange,Exchange Order Id,Execution date and time,Order status,Type
ABC LTD,INE000A01010,10,1000,NSE,X1,10-01-2024 10:15 AM,Executed,BUY`);
  const two = readSheets([{ name: 'Summary', rows: [['Client', 'Z1'], ['Report', 'x']] }, { name: 'FY24', rows: kiteRows }, { name: 'FY25', rows: parseCsv(kite.replace(/,1,O1/, ',11,O11').replace(/,2,O1/, ',12,O11').replace(/,3,O2/, ',13,O12')) }]);
  assert.equal(two.rejected, undefined);
  assert.deepEqual(two.sheetsRead, ['FY24', 'FY25']);
  assert.equal(two.trades.length, 6);
  assert.equal(mergeTrades([two.trades]).trades.length, 6);
  const none = readSheets([{ name: 'A', rows: [['x']] }, { name: 'B', rows: [] }]);
  assert.ok(none.rejected);
  const one = readSheets([{ name: 'Only', rows: [['x']] }]);
  assert.ok(one.rejected && !/^Only:/.test(one.rejected));
  assert.equal(detectBroker(readRows(kiteRows)), 'zerodha');
  assert.equal(detectBroker(readRows(grow)), 'groww');
  assert.equal(detectBroker(readRows(parseCsv('Name,Quantity,Price,Type,Date\nABC,1,10,BUY,2024-01-01'))), null);
});
