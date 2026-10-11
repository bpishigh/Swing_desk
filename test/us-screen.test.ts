import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSectors, parseHoldings, parseStats, stockMetrics, commonDate } from '../src/ingest/us-screen.ts';
import type { Bar } from '../src/ingest/us-eod.ts';

test('sector gate: r3m above the benchmark and close above the 50 SMA; score 2*r3m + r1m; top four', () => {
  const feed = { bench: { r1m: 1, r3m: 5 }, sectors: {
    'Energy (XLE)': { close: 62, sma50: 60, r1m: -3, r3m: 18 },      // score 33
    'Software (IGV)': { close: 90, sma50: 85, r1m: 4, r3m: 10 },      // 24
    'Technology (XLK)': { close: 70, sma50: 66, r1m: 2, r3m: 8 },     // 18
    'Utilities (XLU)': { close: 80, sma50: 79, r1m: 1, r3m: 6 },      // 13
    'Materials (XLB)': { close: 50, sma50: 49, r1m: 0, r3m: 5.5 },    // 11 (fifth)
    'Financials (XLF)': { close: 53, sma50: 56, r1m: -7, r3m: 9 },    // fails: below sma50
    'Health Care (XLV)': { close: 166, sma50: 168, r1m: 0, r3m: 5 },  // fails both
  } };
  assert.deepEqual(pickSectors(feed).map((s) => s.etf), ['XLE', 'IGV', 'XLK', 'XLU']);
  assert.deepEqual(pickSectors({ sectors: feed.sectors }), []);        // no benchmark -> nothing
});
test('holdings: top ten rows, equities only, symbol and weight as shown', () => {
  const row = (...c: string[]) => `<tr>${c.map((x) => `<td>${x}</td>`).join('')}</tr>`;
  const html = '<table><tr><th>No.</th><th>Symbol</th><th>Name</th><th>% Weight</th><th>Shares</th></tr>' +
    row('1', 'XOM', 'ExxonMobil Holdings Corporation', '23.49%', '59,169,889') + row('2', 'CVX', 'Chevron Corporation', '17.66%', '35,424,778') +
    row('3', 'USD', 'US Dollar Cash', '1.00%', '1') + row('4', 'COP', 'ConocoPhillips', '6.81%', '21,539,510') + row('11', 'OKE', 'ONEOK, Inc.', '2.87%', '13,468,834') + '</table>';
  assert.deepEqual(parseHoldings(html).map((h) => [h.symbol, h.weight]), [['XOM', 23.49], ['CVX', 17.66], ['COP', 6.81]]);
});
test('statistics page: 52-week change, averages, volume and the next earnings date', () => {
  const t = '<td>52-Week Price Change</td><td>+48.17%</td><td>50-Day Moving Average</td><td>161.57</td><td>200-Day Moving Average</td><td>150.33</td><td>Average Volume (20 Days)</td><td>12,969,783</td><td>Earnings Date</td><td>Oct 30, 2026</td><td>Ex-Dividend Date</td><td>Aug 17, 2026</td>';
  assert.deepEqual(parseStats(t), { chg52: 48.17, ma50: 161.57, ma200: 150.33, avgVol: 12969783, earnings: '2026-10-30' });
  assert.equal(parseStats('<td>Earnings Date</td><td>-</td>').earnings, null);
});
const day = (i: number) => new Date(Date.UTC(2025, 5, 1 + i)).toISOString().slice(0, 10);
test('metrics follow the Claude Desk definitions', () => {
  // 300 bars: close 100 + i/10, high = close+1, low = close-1, volume 1M, last-day volume 2M
  const bars: Bar[] = Array.from({ length: 300 }, (_, i) => { const c = 100 + i / 10; return [day(i), c, c + 1, c - 1, c, i === 299 ? 2e6 : 1e6, 1, 0]; });
  const m = stockMetrics(bars, 'ABC', 'XLK', 8.5, { ma50: 126.0, earnings: '2026-11-05' })!;
  assert.equal(m.close, 129.9); assert.equal(m.high1, 130.9); assert.equal(m.low3, 128.7);
  assert.equal(m.atr14, 2);                                   // TR = max(h-l = 2, |h-prevC| = 1.1, |l-prevC| = 0.9) = 2 on every bar
  assert.equal(m.sma50, 127.45); assert.equal(m.sma200, 119.95);
  assert.equal(m.high50, 130.9); assert.equal(m.low10, 128);
  assert.equal(m.volRatio, 2); assert.equal(m.avgVol, 1050000); assert.equal(m.adv, Math.round(1050000 * 129.9));
  assert.ok(m.flags.includes('sma50 mismatch') === (Math.abs(127.45 / 126 - 1) > 0.01));
  assert.equal(m.earnings, '2026-11-05');
  assert.equal(stockMetrics(bars.slice(0, 39), 'ABC', 'XLK', 1, { earnings: null }), null);   // under 40 rows: skipped
});
test('screen date is the most common last date', () => {
  assert.equal(commonDate([{ date: '2026-10-09' }, { date: '2026-10-09' }, { date: '2026-10-08' }]), '2026-10-09');
});
