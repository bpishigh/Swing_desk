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
