import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookAlerts, eveningFrom, regimeDropped, type Positions } from '../src/ingest/book-alerts.ts';
import type { Series } from '../src/ingest/us-scan.ts';

const mk = (closes: number[]): Series => ({ c: Float64Array.from(closes), h: Float64Array.from(closes.map((x) => x + 1)), l: Float64Array.from(closes.map((x) => x - 1)), v: Float64Array.from(closes.map(() => 1000)) });
const weekdays = (n: number, start = '2026-01-05'): string[] => { const out: string[] = []; const d = new Date(start + 'T00:00:00Z'); while (out.length < n) { if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } return out; };

test('an open trade closing at or below its stop fires rule 2 and updates maxClose', () => {
  const dates = weekdays(30), c = Array.from({ length: 30 }, (_, i) => 100 + i * 0.1); c[29] = 94;
  const positions: Positions = { legacy: [], trades: [{ market: 'india', symbol: 'AAA', status: 'open', entryDate: dates[20], stop0: 95, stop: 95, lots: [{ shares: 10, price: 102 }], gttPlaced: true, maxClose: 103 }] };
  const r = bookAlerts({ market: 'india', positions, dates, series: () => mk(c), dropped: false });
  assert.equal(r.trades, 1);
  assert.match(r.lines.join('\n'), /AAA: Rule 2/);
  assert.equal(r.updates[0].maxClose, 103);
});

test('a quiet open trade produces no alert; the other market is ignored', () => {
  const dates = weekdays(30), c = Array.from({ length: 30 }, (_, i) => 100 + i * 0.1);
  const positions: Positions = { legacy: [], trades: [{ market: 'us', symbol: 'ZZZ', status: 'open', entryDate: dates[27], stop0: 90, stop: 90, lots: [{ shares: 10, price: 102 }], gttPlaced: true }] };
  assert.deepEqual(bookAlerts({ market: 'india', positions, dates, series: () => mk(c), dropped: false }).lines, []);
  assert.deepEqual(bookAlerts({ market: 'us', positions, dates, series: () => mk(c), dropped: false }).lines, []);
});

test('Legacy: only kept (pass) holdings alert, on the stop or the 200 SMA', () => {
  const dates = weekdays(260), up = Array.from({ length: 260 }, (_, i) => 100 + i * 0.5), down = [...up]; down[259] = 80;
  const positions: Positions = { trades: [], legacy: [
    { symbol: 'KEEP', market: 'india', status: 'pass', stop: 110 },
    { symbol: 'UNCH', market: 'india', status: 'unchecked' },
    { symbol: 'OKAY', market: 'india', status: 'pass', stop: 100 },
  ] };
  const r = bookAlerts({ market: 'india', positions, dates, series: (s) => mk(s === 'OKAY' ? up : down), dropped: false });
  assert.equal(r.legacyKept, 2);
  assert.equal(r.lines.length, 1);
  assert.match(r.lines[0], /KEEP \(Legacy\).*at or below its stop 110/);
});

test('a missing price is reported, not silently skipped', () => {
  const positions: Positions = { trades: [], legacy: [{ symbol: 'GONE', market: 'india', status: 'pass', stop: 10 }] };
  const r = bookAlerts({ market: 'india', positions, dates: weekdays(5), series: () => undefined, dropped: false });
  assert.match(r.missing[0], /GONE/);
});

test('weekly figures appear only on the last session of a week', () => {
  const dates = weekdays(80), s = mk(Array.from({ length: 80 }, (_, i) => 100 + i));
  const fri = dates.findIndex((d, i) => i > 60 && new Date(d + 'T00:00:00Z').getUTCDay() === 5), wed = fri - 2;
  assert.ok(eveningFrom(s, dates, fri).wk10 !== undefined);
  assert.equal(eveningFrom(s, dates, wed).wk10, undefined);
});

test('regime drop is a move to a lower colour', () => {
  assert.equal(regimeDropped('green', 'yellow'), true);
  assert.equal(regimeDropped('red', 'yellow'), false);
  assert.equal(regimeDropped(null, 'red'), false);
});
