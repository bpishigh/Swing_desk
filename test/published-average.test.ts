import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDhanShare, parseDhanEmas, dhanSlugs, solveFactor, checkEmas } from '../src/ingest/published-average.ts';

test('parse a Dhan share-price page (text shape seen on the runner)', () => {
  const t = 'Sample Engineering ... The 50 DMA stands at 150.25 and 200 DMA is at 142.50. Looking at intraday trend ... Symbol : SAMPLE Open : ₹ 148.10 ... Sample share price as of today is ₹ 146. 40 as on 09 Oct 2026 at 03:59 PM . What is the';
  const p = parseDhanShare(t);
  assert.deepEqual(p, { symbol: 'SAMPLE', close: 146.40, asOf: '2026-10-09', asOfTime: '15:59', dma50: 150.25, dma200: 142.5 });
});
test('parse EMAs and build slugs', () => {
  assert.deepEqual(parseDhanEmas('Period Exponential Signal 5-EMA 238.43 Bearish 10-EMA 239.75 Bearish 20-EMA 244.71 Bearish 200-EMA 1,242.99 Bearish'), { 5: 238.43, 10: 239.75, 20: 244.71, 200: 1242.99 });
  assert.equal(dhanSlugs('Sample Engineering & Industries Limited')[0], 'sample-engineering-industries-ltd');
});

// truth: 260 closes, a 0.6 factor break at index 150 (older closes were on the old scale)
const truth = Array.from({ length: 260 }, (_, i) => 100 + 20 * Math.sin(i / 9) + i * 0.05);
const raw = truth.map((c, i) => (i < 150 ? c / 0.6 : c));
test('solving from the published 200 DMA recovers the factor, and the EMA cross-check agrees', () => {
  const n = raw.length, win = truth.slice(n - 201, n - 1);
  const published = win.reduce((a, b) => a + b, 0) / 200;
  const s = solveFactor(raw, 150, Math.round(published * 100) / 100)!;
  assert.ok(Math.abs(s.factor - 0.6) < 0.0005, String(s.factor));
  const emas = { 10: 0, 20: 0 } as Record<number, number>;
  const ck = checkEmas(raw, 150, s.factor, { 20: truthEma(20), 50: truthEma(50), 100: truthEma(100) });
  assert.ok(ck.ok, JSON.stringify(ck));
  void emas;
  const bad = checkEmas(raw, 150, 0.8, { 20: truthEma(20), 50: truthEma(50), 100: truthEma(100) });
  assert.equal(bad.ok, false);
});
function truthEma(k: number): number { let e = truth.slice(0, k).reduce((a, b) => a + b, 0) / k; const a = 2 / (k + 1); for (let i = k; i < truth.length; i++) e += a * (truth[i] - e); return e; }

test('no solution when the break is outside the 200-close window', () => {
  assert.equal(solveFactor(raw, 20, 100), null);
});
