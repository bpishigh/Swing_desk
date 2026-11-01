import test from 'node:test';
import assert from 'node:assert/strict';
import { pctOf, overallScores, overallTest, OS } from '../src/pm/overallscore.ts';

test('percentile ranks: ties share the average rank, ends are 0 and 100', () => {
  assert.deepEqual(pctOf([10, 30, 20]), [0, 100, 50]);
  assert.deepEqual(pctOf([5, 5, 9]), [25, 25, 100]);
});
test('overall score: more return above cash per unit of risk, and a smaller worst fall, score higher', () => {
  const rows = [
    { code: 'calm', r3: 9, r5: 8, vol: 3, dd: -2 }, { code: 'wild', r3: 20, r5: 18, vol: 20, dd: -30 }, { code: 'good', r3: 18, r5: 16, vol: 10, dd: -12 }, { code: 'poor', r3: 7, r5: null, vol: 14, dd: -20 },
  ];
  const s = overallScores(rows, 6.5, 6.5);
  assert.ok((s.get('good') as number) > (s.get('wild') as number));
  assert.ok((s.get('calm') as number) > (s.get('poor') as number));
  assert.equal(Math.max(...s.values()), 100); assert.equal(Math.min(...s.values()), 0);
});
// synthetic NAVs: business days from 2009 to 2026-11, fund i grows at g_i a year with noise level v_i
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
function mk(g: number, v: number, seed: number) {
  const nav: Record<string, number> = {}; let x = 100, s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; };
  for (let t = Date.UTC(2009, 0, 1); t < Date.UTC(2026, 10, 1); t += 86400000) { const dow = new Date(t).getUTCDay(); if (dow === 0 || dow === 6) continue; x *= 1 + g / 252 + v * rnd() * 0.1; nav[ymd(t)] = x; }
  return nav;
}
test('look-ahead test runs end to end and reports a boolean pass with its three parts', () => {
  const series = new Map<string, Record<string, number>>(); const funds: string[] = [], cash: string[] = [];
  for (let i = 0; i < 40; i++) { series.set('f' + i, mk(0.05 + 0.004 * i, 0.2 + 0.02 * (i % 7), 7 + i)); funds.push('f' + i); }
  for (let i = 0; i < 6; i++) { series.set('c' + i, mk(0.065, 0.002, 900 + i)); cash.push('c' + i); }
  const r = overallTest(funds, cash, series);
  assert.ok(r.counted >= OS.minYears); assert.equal(typeof r.pass, 'boolean');
  assert.equal(r.pass, r.parts.share && r.parts.median && r.parts.worst);
  for (const y of r.years) { assert.ok(y.eligible >= OS.minFunds); assert.ok(Number.isFinite(y.exSharpe)); }
});
