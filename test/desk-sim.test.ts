import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deskSim, weekEnds } from '../src/backtest/desk-sim.ts';
import { makeCalendar } from '../src/engine/calendar.ts';

// 80 weekdays from Mon 2026-01-05; entry on index 5 at trigger 100 with stop 95 (1R = 5).
const dates: string[] = []; { const d = new Date(Date.UTC(2026, 0, 5)); while (dates.length < 80) { if (d.getUTCDay() % 6 !== 0) dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } }
const cal = makeCalendar();
const mk = (path: (i: number) => number) => { const c = dates.map((_, i) => path(i)); return { c, h: c.map((v) => v + 0.5), l: c.map((v) => v - 0.5) }; };
const run = (path: (i: number) => number, extra: Record<string, unknown> = {}) => { const s = mk(path); return deskSim({ dates, ...s, e: 5, trigger: 100, stop: 95, setup: '2', cal, ...extra } as never)!; };

test('weekEnds marks the last session of each week', () => {
  const w = weekEnds(dates); assert.equal(w[4], true); assert.equal(w[3], false); assert.equal(w[79], true);
});

test('stop hit: the whole position is sold at the stop for -1R', () => {
  const r = run((i) => (i < 7 ? 100.5 : 94)); // low 93.5 <= 95 on index 7
  assert.equal(r.reason, 'stop'); assert.ok(Math.abs(r.R - -1) < 1e-9);
});

test('a flat trade is closed by the time stop (rule 4), at the next close', () => {
  const r = run((i) => 101 + 0.01 * i); // never reaches +1R (105)
  assert.match(r.reason, /Rule 4/); assert.ok(r.held >= 11 && r.held <= 14, `held ${r.held}`);
});

test('rule 6 does not fire before the third is sold: a close below the 20 EMA in week 2 is held', () => {
  // up to 103, then a dip to 101.5 (below the 20 EMA near 102.5) but above the stop; recovers
  const r = run((i) => (i < 8 ? 100.8 + 0.3 * (i - 5) : i < 11 ? 101.6 : 104.5));
  assert.ok(!/Rule 6/.test(r.reason), r.reason);
});

test('the +2R close sells a third next session and the stop goes to entry; the rest stops out at entry', () => {
  // closes 111 on index 8 (+2.2R) -> sell 33 at the next close; later drop through entry (100)
  const r = run((i) => (i < 8 ? 102 : i < 10 ? 111 : i < 14 ? 108 : 98));
  const third = r.sold.find((s) => s.why === 'Rule 5'); assert.ok(third && third.shares === 33);
  assert.equal(r.reason, 'stop-at-entry');
  const expected = (33 * (111 - 100) + 67 * 0) / (100 * 5); assert.ok(Math.abs(r.R - expected) < 1e-9, `${r.R} vs ${expected}`);
});

test('a breakout that closes back below its pivot in the first 3 sessions is sold (rule 3)', () => {
  const s = mk((i) => (i < 6 ? 100.2 : 100.1)); // closes 100.2 on the entry day, below pivot 101
  const r = deskSim({ dates, ...s, e: 5, trigger: 100, stop: 95, setup: '1', pivot: 101, cal })!;
  assert.match(r.reason, /Rule 3/);
});

test('rule 8: results within 2 sessions and a gain below 2R closes the trade', () => {
  const r = run((i) => 103, { resultsDate: dates[12] });
  assert.match(r.reason, /Rule 8/);
  const off = run((i) => 103, { resultsDate: dates[12], rules: { rule8: false } });
  assert.ok(!/Rule 8/.test(off.reason));
});

test('the 60-session cap closes whatever is left at the last close', () => {
  const r = run((i) => 100 + 0.9 * (i - 5) * 0 + (i % 2) * 0.1 + 6 + i * 0.12, { maxHold: 20 });
  assert.ok(r.held <= 21);
});
