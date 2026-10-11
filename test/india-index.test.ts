import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndexCloseCsv, findIndex, mergeDay, indexStats, buildFeed, buildTracker, jumpFlags, normalise, INDIA_INDICES } from '../src/ingest/india-index.ts';

const HEAD = 'Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%),Volume,Turnover (Rs. Cr.),P/E,P/B,Div Yield';
const line = (n: string, d: string, c: number, v = '1000000') => `${n},${d},${c - 5},${c + 10},${c - 10},${c},1,0.1,${v},1,20,3,1`;
const csv = (d: string, c = 100) => [HEAD, ...Object.values(INDIA_INDICES).map((ns) => line(ns[0], d, c)), line('India VIX', d, 14.5)].join('\n');

test('parse reads the date from inside the file and every row', () => {
  const day = parseIndexCloseCsv(csv('09-10-2026'));
  assert.equal(day.date, '2026-10-09');
  assert.equal(day.rows.length, 22);
  assert.equal(findIndex(day, INDIA_INDICES['Nifty Healthcare'])?.close, 100);
});

test('parse rejects a file with mixed dates and one with no rows', () => {
  assert.throws(() => parseIndexCloseCsv([HEAD, line('Nifty 50', '08-10-2026', 1), line('Nifty IT', '09-10-2026', 1)].join('\n')), /2 dates/);
  assert.throws(() => parseIndexCloseCsv(HEAD), /no data rows/);
});

test('names match despite case, ampersand and the word Index', () => {
  assert.equal(normalise('NIFTY Oil & Gas Index'), normalise('Nifty Oil and Gas'));
  const day = parseIndexCloseCsv([HEAD, line('Nifty Healthcare Index', '09-10-2026', 50)].join('\n'));
  assert.equal(findIndex(day, INDIA_INDICES['Nifty Healthcare'])?.close, 50);
});

const seed = (n: number, key = 'Nifty 50') => {
  const h: Record<string, number> = {}; const d = new Date(Date.UTC(2026, 0, 1));
  for (let i = 0; i < n; i++) { h[d.toISOString().slice(0, 10)] = 100 + i; d.setUTCDate(d.getUTCDate() + 1); }
  return { asOf: Object.keys(h).pop()!, closes: { [key]: h } };
};

test('stats: SMA runs through the session before D and needs the full window', () => {
  const store = seed(60); const dates = Object.keys(store.closes['Nifty 50']);
  const D = dates[59];
  const st = indexStats(store.closes['Nifty 50'], D)!;
  // last 50 closes dated before D are values 109..158 -> mean 133.5
  assert.equal(st.sma50, 133.5);
  assert.equal(st.sma200, undefined);
  assert.equal(st.maAsOf, dates[58]);
});

test('merge never overwrites a stored date, reports conflicts and missing names', () => {
  const store = { asOf: '2026-10-08', closes: { 'Nifty 50': { '2026-10-09': 99 } } };
  const r = mergeDay(store, parseIndexCloseCsv(csv('09-10-2026', 100)));
  assert.equal(r.store.closes['Nifty 50']['2026-10-09'], 99);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.added.length, 20);
  assert.equal(r.store.asOf, '2026-10-09');
  const r2 = mergeDay(store, parseIndexCloseCsv([HEAD, line('Nifty 50', '09-10-2026', 99)].join('\n')));
  assert.equal(r2.missing.length, 20);
});

test('feed and tracker for D carry source, flags, and omit what cannot be computed', () => {
  let store: any = { asOf: '2026-01-01', closes: {} };
  for (let i = 0; i < 3; i++) store = mergeDay(store, parseIndexCloseCsv(csv(`0${i + 5}-10-2026`, 100 + i))).store;
  const day = parseIndexCloseCsv(csv('07-10-2026', 102));
  const feed = buildFeed(store, '2026-10-07', 'T', 'NSE index close file (07-Oct-2026)');
  assert.equal(Object.keys(feed.sectors).length, 19);
  assert.equal(feed.sectors['Nifty IT'].src, 'NSE index close file (07-Oct-2026)');
  assert.equal(feed.sectors['Nifty IT'].sma200, undefined);
  assert.ok(feed.flags.some((f) => /200 SMA omitted/.test(f)));
  const tr = buildTracker(store, day, 'T', 'NSE index close file')!;
  assert.equal(tr.close, 102); assert.equal(tr.vix, 14.5); assert.equal(tr.volume, 1);
  assert.ok(tr.b && tr.b.close === 102);
});

test('a 12%+ move from the previous stored close is flagged', () => {
  const store = { asOf: '2026-10-09', closes: { 'Nifty 50': { '2026-10-08': 100, '2026-10-09': 80 } } };
  assert.equal(jumpFlags(store, '2026-10-09').length, 1);
  assert.equal(jumpFlags(store, '2026-10-09', 25).length, 0);
});
