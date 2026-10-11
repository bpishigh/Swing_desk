import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyze, regimeFrom, smaLevel, type TrackerRow } from '../src/engine/regime.ts';

const load = (dir: string): TrackerRow[] =>
  readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ date: f.slice(0, -5), ...JSON.parse(readFileSync(dir + f, 'utf8')) }) as TrackerRow)
    .sort((a, b) => a.date.localeCompare(b.date));

// Engine Rules: Regime traffic light, Trend row.
test('trend level: green needs above both averages with the 50 rising', () => {
  assert.equal(smaLevel(110, 100, 90, true), 2);
  assert.equal(smaLevel(110, 100, 90, false), 1);
  assert.equal(smaLevel(110, 100, 90, null), 1); // unknown counts as not rising
  assert.equal(smaLevel(95, 100, 90, true), 1);  // above one, below the other
  assert.equal(smaLevel(85, 100, 90, true), 0);  // below both
  assert.equal(smaLevel(110, 100, undefined, true), null);
});

// Engine Rules: Distribution day = down 0.2% or more on higher volume; skipped days never count.
test('distribution days: threshold, volume and skip', () => {
  const mk = (d: string, close: number, volume: number, skip = false): TrackerRow => ({ date: d, close, high: close, low: close, volume, skip });
  const rows = [mk('2026-01-01', 100, 10), mk('2026-01-02', 99.8, 11), mk('2026-01-05', 99.7, 12), mk('2026-01-06', 99.0, 13, true), mk('2026-01-07', 98.5, 14)];
  const a = analyze(rows);
  // 01-02: -0.2% on higher volume -> counts; 01-05: -0.1% -> no; 01-06 skipped; 01-07: -0.51% higher volume -> counts
  assert.deepEqual(a.dist.map((d) => d.date), ['2026-01-02', '2026-01-07']);
});

test('distribution day drops out when the index closes 5% above it', () => {
  const rows: TrackerRow[] = [
    { date: '2026-01-01', close: 100, high: 100, low: 100, volume: 10 },
    { date: '2026-01-02', close: 99, high: 99, low: 99, volume: 11 },
    { date: '2026-01-05', close: 104.0, high: 104, low: 104, volume: 9 },
  ];
  assert.equal(analyze(rows).active.length, 0);
  assert.equal(analyze(rows).expiredEarly.length, 1);
});

test('five active distribution days cap a green trend at yellow', () => {
  const rows: TrackerRow[] = [];
  let close = 100, vol = 10;
  for (let i = 0; i < 8; i++) {
    rows.push({ date: `2026-02-${String(i + 1).padStart(2, '0')}`, close, high: close + 0.1, low: close - 0.1, volume: vol, sma50: 50 + i * 0.1, sma200: 40, breadth: 60, b: { close: 100, sma50: 60 + i * 0.1, sma200: 40 } });
    close *= 0.997; vol += 1; // each day down 0.3% on rising volume
  }
  const r = regimeFrom(rows);
  assert.ok(r && !r.incomplete);
  assert.ok(r.analysis.active.length >= 5);
  assert.equal(r.lv, 1);
});

test('breadth below 40 caps at yellow; breadth read from the latest of the last 3 rows', () => {
  const base = (d: string, breadth?: number): TrackerRow => ({ date: d, close: 110, high: 111, low: 109, volume: 10, sma50: 100, sma200: 90, breadth, b: { close: 110, sma50: 100, sma200: 90 } });
  const rows = [base('2026-03-01'), base('2026-03-02'), base('2026-03-03', 35), base('2026-03-04'), base('2026-03-05')];
  rows[0].sma50 = 99; rows[0].b!.sma50 = 99; // so the 50 SMA is rising on the last row
  const r = regimeFrom(rows);
  assert.ok(r && !r.incomplete);
  assert.equal(r.breadth, 35);
  assert.equal(r.lv, 1);
});

// Replay: the TS engine must give the same result as the original v9 code on the exported fixtures, row by row.
for (const [name, dir] of [['india', 'fixtures/db/tracker/'], ['us', 'fixtures/db/us_tracker/']] as const) {
  test(`replay vs v9 golden (${name})`, () => {
    const golden = JSON.parse(readFileSync(`fixtures/expected/regime-v9-${name}.json`, 'utf8')).rows as any[];
    const rows = load(dir);
    assert.equal(golden.length, rows.length);
    rows.forEach((_, i) => {
      const g = golden[i];
      const r = regimeFrom(rows.slice(0, i + 1), { v9: true });
      assert.ok(r, g.date);
      if (g.incomplete) { assert.equal((r as any).incomplete, true, `${g.date} incomplete`); return; }
      assert.ok(!(r as any).incomplete, `${g.date} complete`);
      const x = r as Exclude<typeof r, null | { incomplete: true }>;
      assert.equal(x.lv, g.lv, `${g.date} lv`);
      assert.equal(x.sma, g.sma, `${g.date} sma`);
      assert.equal(x.la, g.la, `${g.date} la`);
      assert.equal(x.lb, g.lb, `${g.date} lb`);
      assert.equal(x.risingA, g.risingA, `${g.date} risingA`);
      assert.equal(x.risingB, g.risingB, `${g.date} risingB`);
      assert.equal(Number.isFinite(x.breadth) ? x.breadth : null, g.breadth, `${g.date} breadth`);
      assert.equal(x.analysis.active.length, g.activeDist, `${g.date} active dist`);
      assert.equal(x.analysis.expiredEarly.length, g.expiredEarly, `${g.date} expired early`);
      assert.equal(x.analysis.status, g.ftdStatus, `${g.date} ftd`);
    });
  });
}
