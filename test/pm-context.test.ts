import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeContext } from '../src/pm/context.ts';
const dates = Array.from({ length: 260 }, (_, i) => new Date(Date.parse('2025-01-01') + i * 86400000).toISOString().slice(0, 10));
const ramp = (a: number, b: number) => dates.map((_, i) => a + ((b - a) * i) / 259);
const hist = { dates, px: { UP: ramp(100, 200), DOWN: ramp(200, 100), HALF: dates.map((_, i) => (i === 259 ? null : 100)) } };
const bhav = Array.from({ length: 40 }, (_, i) => ({ date: dates[220 + i], rows: { UP: ['EQ', 1, 1, 1, 1, 150, 1e6, 40 + (i >= 20 ? 10 : 0)], DOWN: ['BE', 1, 1, 1, 1, 150, 1e5, 20] } as Record<string, (string | number | null)[]> }));
test('trend, relative strength, liquidity and delivery are computed from stored data', () => {
  const idx = { dates: dates.slice(0, 100), closes: Array.from({ length: 100 }, (_, i) => 100 + i) };
  const c = computeContext(hist, [], bhav, idx);
  const u = c.stocks.UP, d = c.stocks.DOWN;
  assert.ok(u.vs50! > 0 && u.vs200! > 0 && d.vs50! < 0 && d.vs200! < 0);
  assert.equal(u.rs, 100); assert.equal(d.rs, 0);
  assert.equal(c.indexRet63, Math.round(((199 / 136) - 1) * 10000) / 100);
  assert.equal(u.vsIndex, Math.round((u.ret63! - c.indexRet63!) * 100) / 100);
  assert.equal(u.advCr, 15);                                   // 150 x 1,000,000 = ₹15 crore a day
  assert.equal(u.deliv, 50); assert.equal(u.delivPrev, 40); assert.equal(u.series, 'EQ'); assert.equal(d.series, 'BE');
  assert.equal(c.stocks.HALF, undefined);                      // no close on the last day: no context
});
test('a split is adjusted before the trend is read, and short liquidity history gives null, not a guess', () => {
  const px = ramp(100, 200).map((v, i) => (i >= 250 ? v / 5 : v));
  const h = { dates, px: { AAA: px } };
  const c = computeContext(h, [{ symbol: 'AAA', exDate: dates[250], subject: ' Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share' }], bhav.slice(0, 3), null);
  assert.ok(c.stocks.AAA.vs200! > 0); assert.equal(c.stocks.AAA.advCr, null); assert.equal(c.stocks.AAA.vsIndex, null);
});
test('volume on up days against down days, and the verdict state, are in the context', () => {
  const idx = null;
  const rows = (i: number) => ({ UP: ['EQ', 100, 1, 1, 1, i % 2 ? 101 : 99, i % 2 ? 3000 : 1000, 40] } as Record<string, (string | number | null)[]>);
  const bh = Array.from({ length: 40 }, (_, i) => ({ date: dates[220 + i], rows: rows(i) }));
  const c = computeContext(hist, [], bh, idx);
  assert.equal(c.stocks.UP.upDown, 3); assert.equal(c.stocks.UP.state, 'Keep'); assert.equal(c.stocks.DOWN.state, '200 only: far (beyond both)');   // a straight fall has no confirmed swing low, so only the 200-day leg fails
});
test('the 50-day average against the 200-day average is in the context', () => {
  const c = computeContext(hist, [], [], null);
  assert.ok(c.stocks.UP.s50vs200! > 0); assert.ok(c.stocks.DOWN.s50vs200! < 0);
});
