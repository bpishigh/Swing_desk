import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTiingo, mergeBars, adjustedThrough, usStats, parseStockAnalysis, parseCboeVix, agree, type Bar } from '../src/ingest/us-eod.ts';

const day = (i: number) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
/** n bars at `price`; a 2-for-1 split at index `at` halves the traded price from that day on. */
const mk = (n: number, price: number, at = -1): Bar[] => Array.from({ length: n }, (_, i) => {
  const p = at >= 0 && i >= at ? price / 2 : price;
  return [day(i), p, p + 1, p - 1, p, 1_000_000 * (at >= 0 && i >= at ? 2 : 1), i === at ? 2 : 1, 0];
});

test('Tiingo rows parse; bad rows are dropped and counted', () => {
  const r = parseTiingo([
    { date: '2026-10-09T00:00:00.000Z', open: 776.24, high: 779.42, low: 775.14, close: 778.57, volume: 22624488, splitFactor: 1, divCash: 0 },
    { date: '2026-10-08T00:00:00.000Z', open: 1, high: 0.5, low: 1, close: 1, volume: 1, splitFactor: 1, divCash: 0 },   // high < low
    { date: 'bad', open: 1, high: 1, low: 1, close: 1, volume: 1 },
  ]);
  assert.equal(r.bars.length, 1); assert.equal(r.dropped, 2); assert.equal(r.bars[0][0], '2026-10-09');
  assert.throws(() => parseTiingo({}));
});
test('merge never overwrites a stored date; a changed close is a conflict', () => {
  const a = mk(5, 100);
  const m = mergeBars(a, [...mk(5, 100).slice(3), [day(5), 1, 2, 0.5, 101, 5, 1, 0]]);
  assert.equal(m.added, 1); assert.equal(m.conflicts.length, 0); assert.equal(m.bars.length, 6);
  const c = mergeBars(a, [[day(2), 1, 2, 0.5, 110, 5, 1, 0]]);
  assert.equal(c.conflicts.length, 1); assert.equal(c.bars.find((b) => b[0] === day(2))![4], 100);
});
test('split adjustment: a 2-for-1 leaves no break and the averages run straight through it', () => {
  const bars = mk(260, 200, 130);
  const s = adjustedThrough(bars, day(259));
  assert.ok(s.close.every((c) => Math.abs(c - 100) < 1e-9));
  assert.equal(s.volume[0], 2_000_000);           // pre-split volume restated to the new share count
  const st = usStats(bars, day(259))!;
  assert.equal(st.sma50, 100); assert.equal(st.sma200, 100); assert.deepEqual(st.breaks, []);
});
test('SMA includes the day itself, is omitted when the window is short, and a break removes it', () => {
  const rising: Bar[] = Array.from({ length: 60 }, (_, i) => [day(i), i + 1, i + 2, i, i + 1, 2e6, 1, 0]);
  const st = usStats(rising, day(59))!;
  assert.equal(st.sma50, 35.5);                    // mean of closes 11..60
  assert.equal(st.sma200, undefined);
  const jump: Bar[] = mk(260, 100); jump[200] = [day(200), 160, 161, 159, 160, 1e6, 1, 0];   // +60% one day, no split recorded
  jump.forEach((b, i) => { if (i > 200) { b[1] = b[2] = b[3] = b[4] = 160; } });
  const j = usStats(jump, day(259))!;
  assert.equal(j.breaks.length, 1); assert.equal(j.sma200, undefined);   // window of 200 starts before the break
  assert.equal(j.sma50, 160);                                             // window of 50 is after it
});
test('returns use the last close on or before the same calendar day', () => {
  const bars: Bar[] = Array.from({ length: 120 }, (_, i) => [day(i), 100 + i, 101 + i, 99 + i, 100 + i, 1e6, 1, 0]);
  const st = usStats(bars, day(119))!;   // 2025-04-30 against 2025-03-30 (index 88, close 188); close on day 119 is 219
  assert.equal(st.r1m, Math.round((219 / 188 - 1) * 10000) / 100);
  assert.equal(st.r3m, Math.round((219 / 129 - 1) * 10000) / 100);   // 2025-01-30 is index 29, close 129
  const short = usStats(bars.slice(60), day(119))!;                  // only 60 days of history
  assert.equal(short.r3m, undefined); assert.equal(short.r1m, 16.49);
});
test('StockAnalysis table and Cboe file parse', () => {
  const html = '<table><tr><th>Date</th><th>Open</th></tr><tr><td>Oct 9, 2026</td><td>776.24</td><td>779.40</td><td>775.23</td><td>778.57</td><td>778.57</td><td>0.60%</td><td>22,760,961</td></tr><tr><td>Oct 8, 2026</td><td>774.86</td><td>777.09</td><td>770.44</td><td>773.93</td><td>773.93</td><td>-0.42%</td><td>38,430,690</td></tr></table>';
  assert.deepEqual(parseStockAnalysis(html), { '2026-10-09': 778.57, '2026-10-08': 773.93 });
  assert.deepEqual(parseCboeVix('DATE,OPEN,HIGH,LOW,CLOSE\n10/08/2026,15.68,16.46,15.15,15.41\n10/09/2026,15.34,15.34,14.77,14.84\n'), { '2026-10-08': 15.41, '2026-10-09': 14.84 });
  assert.ok(agree(778.57, 778.2)); assert.ok(!agree(778.57, 770));
});

test('parseNasdaq reads the public history reply: dates, dollar signs, thousands separators', async () => {
  const { parseNasdaq } = await import('../src/ingest/us-eod.ts');
  const reply = { data: { tradesTable: { rows: [
    { date: '10/09/2026', close: '$778.57', volume: '22,624,490', open: '$776.24', high: '$779.42', low: '$775.14' },
    { date: '10/08/2026', close: '$770.00', volume: '30,000,000', open: '$768', high: '$772', low: '$767' },
    { date: 'bad', close: '$1', volume: '1', open: '$1', high: '$1', low: '$1' },
  ] } } };
  const { bars, dropped } = parseNasdaq(reply);
  assert.equal(dropped, 1);
  assert.deepEqual(bars[1], ['2026-10-09', 776.24, 779.42, 775.14, 778.57, 22624490, 1, 0]);
  assert.equal(bars[0][0], '2026-10-08');
  assert.throws(() => parseNasdaq({ data: null }));
});
