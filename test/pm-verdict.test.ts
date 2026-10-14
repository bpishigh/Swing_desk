import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swingLow, sma, stockVerdict, PIVOT_SIDE } from '../src/pm/verdict.ts';
const mkDates = (n: number, start = '2025-01-01') => Array.from({ length: n }, (_, i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10));
const hist = (symbol: string, closes: (number | null)[]) => ({ dates: mkDates(closes.length), px: { [symbol]: closes } });
// 250 sessions rising from 100 to 200, with a clear dip pivot at index 200
const rising = (n = 250) => Array.from({ length: n }, (_, i) => 100 + (i * 100) / (n - 1));

test('swing low is the most recent close that is the lowest of 10 sessions each side', () => {
  const c = rising(); c[200] = 120;                        // a dip, far below its neighbours
  const d = mkDates(c.length);
  assert.deepEqual(swingLow(d, c), { price: 120, date: d[200] });
});
test('a pivot is only confirmed after 10 later sessions: the last 10 sessions never qualify', () => {
  const c = rising(); c[150] = 110; c[c.length - 3] = 50;   // an older pivot at 110; the fresh low is not yet confirmed
  const sl = swingLow(mkDates(c.length), c);
  assert.equal(sl?.price, 110);
});
test('no pivot in a short or empty series', () => { assert.equal(swingLow(mkDates(15), rising(15)), null); assert.equal(swingLow([], []), null); });
test('sma needs the full window of real closes', () => {
  assert.equal(sma(rising(199)), null); assert.equal(sma([...rising(199), null]), null);
  assert.ok(Math.abs((sma(Array(200).fill(10)) as number) - 10) < 1e-9);
});
test('keep: above the 200 SMA and above the swing low', () => {
  const c = rising(); c[200] = 120;
  const v = stockVerdict('AAA', hist('AAA', c));
  assert.equal(v.label, 'Keep'); assert.equal(v.below200, false); assert.equal(v.belowSwing, false);
  assert.ok(v.pending.length === 1 && /Trim/.test(v.pending[0]));
});
test('exit: close below the 200 SMA', () => {
  const c = rising(); c[c.length - 1] = 90;
  const v = stockVerdict('AAA', hist('AAA', c)); assert.equal(v.label, 'Exit'); assert.equal(v.below200, true); assert.match(v.reasons.join(' '), /200 SMA/);
});
test('exit: close below the last swing low even while above the 200 SMA', () => {
  const c = [...Array.from({ length: 150 }, (_, i) => 100 + (2 * i) / 3), ...Array(100).fill(200)]; c[200] = 190;   // flat top; pivot at 190; 200 SMA is about 178
  c[c.length - 1] = 185;
  const v = stockVerdict('AAA', hist('AAA', c));
  assert.equal(v.below200, false); assert.equal(v.belowSwing, true); assert.equal(v.label, 'Exit'); assert.match(v.reasons.join(' '), /swing low/);
});
test('no verdict, with the reason, when data is missing, stale, short or crosses a split', () => {
  assert.match(stockVerdict('ZZZ', hist('AAA', rising())).reasons[0], /No stored price history/);
  const stale = hist('AAA', [...rising(), null, null, null, null, null, null, null, null]); assert.match(stockVerdict('AAA', stale).reasons[0], /older than/);
  const short = stockVerdict('AAA', hist('AAA', rising(120))); assert.equal(short.label, 'No verdict'); assert.match(short.reasons.join(' '), /200 sessions/);
  const h = hist('AAA', rising());
  const split = stockVerdict('AAA', h, [{ symbol: 'AAA', exDate: h.dates[200], subject: 'Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 5/- Per Share' }]);
  assert.equal(split.label, 'No verdict'); assert.match(split.reasons[0], /corporate action/);
  const old = stockVerdict('AAA', h, [{ symbol: 'AAA', exDate: '2020-01-01', subject: 'Bonus 1:1' }]); assert.equal(old.label, 'Keep');
  const div = stockVerdict('AAA', h, [{ symbol: 'AAA', exDate: h.dates[200], subject: 'Dividend - Rs 5 Per Share' }]); assert.equal(div.label, 'Keep');
});
test('a missing close inside the window does not break the pivot search', () => {
  const c: (number | null)[] = rising(); c[200] = 120; c[203] = null;
  assert.equal(swingLow(mkDates(c.length), c)?.price, 120);
  assert.equal(PIVOT_SIDE, 10);
});
