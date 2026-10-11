import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pctAbove50 } from '../src/ingest/breadth.ts';
import { regimeReport } from '../src/ingest/regime-run.ts';
import type { TrackerRow } from '../src/engine/regime.ts';

const dates = Array.from({ length: 60 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);   // labels only; the function never parses them
const rising = (start: number, step: number) => dates.map((_, i) => start + i * step);

test('breadth counts stocks above their own 50-day average, window includes the day', () => {
  const all = { UP: { dates, closes: rising(100, 1) }, DOWN: { dates, closes: rising(200, -1) }, FLAT: { dates, closes: dates.map(() => 50) } };
  const r = pctAbove50(all, dates[59])!;
  assert.deepEqual([r.n, r.pct], [3, 33.3]);        // only UP is above; FLAT equals its average, which is not above
});
test('a stock with a one-day move beyond 22% in the window is left out; short histories are skipped', () => {
  const split = rising(100, 0.1).map((c, i) => (i >= 30 ? c / 5 : c));
  const all = { SPLIT: { dates, closes: split }, OK: { dates, closes: rising(100, 1) }, NEW: { dates: dates.slice(40), closes: rising(100, 1).slice(40) } };
  const r = pctAbove50(all, dates[59])!;
  assert.deepEqual([r.n, r.skipped], [1, 2]);
});
test('no usable stock -> null', () => assert.equal(pctAbove50({}, '2026-01-01'), null));

function row(i: number, close: number, extra: Partial<TrackerRow> = {}): TrackerRow {
  const d = new Date(Date.parse('2026-06-01') + i * 864e5).toISOString().slice(0, 10);
  return { date: d, close, high: close + 1, low: close - 1, volume: 100, sma50: 100 + i * 0.2, sma200: 90, b: { close, sma50: 100 + i * 0.2, sma200: 90 }, ...extra };
}
test('regime alert on a level change, with the reason', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(i, 110 + i * 0.1, { breadth: 60 }));
  const g = regimeReport('US', rows, {}, null)!;
  assert.equal(g.record.name, 'green'); assert.equal(g.alert, null);
  const rows2 = [...rows.slice(0, -1), { ...rows[29], breadth: 30 }];
  const y = regimeReport('US', rows2, {}, g.record)!;
  assert.equal(y.record.name, 'yellow');
  assert.match(y.alert!, /US regime: Green → Yellow/);
  assert.match(y.alert!, /breadth 30% below 40/);
});
test('no alert when nothing changed; null when the tracker has no averages', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(i, 110 + i * 0.1, { breadth: 60 }));
  const a = regimeReport('India', rows, {}, null)!;
  assert.equal(regimeReport('India', rows, {}, a.record)!.alert, null);
  assert.equal(regimeReport('India', [{ date: '2026-06-01', close: 5 }], {}, null), null);
});
