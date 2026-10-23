import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest, BT } from '../src/pm/fundbacktest.ts';

// Synthetic market: 60 funds in one category; fund i earns drift i (persistent) or noise only, so the test machinery can be checked on both outcomes.
function build(persist: boolean) {
  const schemes = [], series = new Map();
  for (let i = 0; i < 60; i++) {
    const code = 'F' + i; schemes.push({ code, isin: '', name: code + ' Flexi Cap Fund - Direct Plan - Growth', category: 'Equity Scheme - Flexi Cap Fund' });
    const nav = {}; let v = 10, seed = i * 7919 + 13; const d = new Date('2008-01-01T00:00:00Z');
    while (d.toISOString().slice(0, 10) <= '2026-10-05') {
      const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) { seed = (seed * 1103515245 + 12345) % 2147483648; const noise = ((seed / 2147483648) - 0.5) * 0.02; v *= 1 + 0.0003 + (persist ? (i - 30) * 0.00001 : 0) + noise; nav[d.toISOString().slice(0, 10)] = v; }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    series.set(code, nav);
  }
  return { schemes, series };
}
test('with persistent skill the Strong group beats and the Weak group trails the category median in most years', () => {
  const { schemes, series } = build(true), r = runBacktest(schemes, series);
  assert.equal(r.points.length, BT.lastYear - BT.firstYear + 1);
  assert.ok(r.testA.counted >= BT.minYears, JSON.stringify(r.testA));
  assert.ok(r.testA.pass && r.testB.pass && r.replaceOn, JSON.stringify([r.testA, r.testB]));
});
test('with no persistence at least one test fails, so Replace stays off', () => {
  const { schemes, series } = build(false), r = runBacktest(schemes, series);
  assert.equal(r.replaceOn, false, JSON.stringify([r.testA, r.testB]));
});
test('scoring at a date uses no later NAV: changing every NAV after that date leaves the points before it unchanged', () => {
  const { schemes, series } = build(true), a = runBacktest(schemes, series);
  const alt = new Map([...series].map(([k, nav]) => [k, Object.fromEntries(Object.entries(nav).map(([d, v]) => [d, d > '2019-10-01' ? v * 1.5 : v]))]));
  const b = runBacktest(schemes, alt);
  assert.deepEqual(a.points[0].scored, b.points[0].scored);
  assert.equal(a.points[0].strong, b.points[0].strong);
});

test('Test C counts funds scoring 25 to 35 and reports its own pass or fail', () => {
  const { schemes, series } = build(true), r = runBacktest(schemes, series);
  assert.ok(r.points.every((p) => typeof p.near === 'number'));
  assert.equal(typeof r.testC.pass, 'boolean'); assert.equal(r.nearWeakOn, r.testC.pass);
});

test('Tests D and E run with index and liquid funds supplied, and are untestable (rule off) without them', () => {
  const { schemes, series } = build(true);
  const idx = Array.from({ length: 4 }, (_, i) => ({ code: 'I' + i, isin: '', name: 'Idx' + i + ' Nifty 50 Index Fund - Direct Plan - Growth', category: 'Index' }));
  const liquid = Array.from({ length: 4 }, (_, i) => 'L' + i);
  const s2 = new Map(series); const mk = (drift: number, seed: number) => { const o: Record<string, number> = {}; let v = 10, q = seed; const d = new Date('2008-01-01T00:00:00Z'); while (d.toISOString().slice(0, 10) <= '2026-10-05') { const w = d.getUTCDay(); if (w !== 0 && w !== 6) { q = (q * 1103515245 + 12345) % 2147483648; v *= 1 + drift + ((q / 2147483648) - 0.5) * 0.004; o[d.toISOString().slice(0, 10)] = v; } d.setUTCDate(d.getUTCDate() + 1); } return o; };
  idx.forEach((x, i) => s2.set(x.code, mk(0.0004, 100 + i))); liquid.forEach((c, i) => s2.set(c, mk(0.0002, 200 + i)));
  const r = runBacktest(schemes, s2, undefined, undefined, { idx: idx as any, liquid });
  assert.ok(r.points.some((p) => p.nD > 0), JSON.stringify(r.testD));
  assert.equal(r.indexRuleOn, r.testD.pass); assert.equal(r.cashRuleOn, r.testE.pass);
  const none = runBacktest(schemes, series);
  assert.equal(none.indexRuleOn, false); assert.equal(none.cashRuleOn, false);
});
