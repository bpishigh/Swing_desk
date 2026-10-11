import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, regimeFrom, type TrackerRow } from '../src/engine/regime.ts';
import { makeCalendar, WEEKDAYS } from '../src/engine/calendar.ts';
import { readFileSync } from 'node:fs';

// ---- helpers: a benchmark series with its own SMAs, built from a list of daily % moves ----
const nextWeekday = (d: string): string => { const x = new Date(d + 'T00:00:00Z'); do { x.setUTCDate(x.getUTCDate() + 1); } while ([0, 6].includes(x.getUTCDay())); return x.toISOString().slice(0, 10); };
function build(moves: { pct: number; vol: number; breadth?: number; skip?: boolean }[], start = '2025-01-02', first = 100): TrackerRow[] {
  const rows: TrackerRow[] = []; let c = first, d = start;
  const closes: number[] = [];
  moves.forEach((m, i) => {
    const prev = c; c = c * (1 + m.pct / 100); closes.push(c);
    const avg = (w: number) => (i >= w ? closes.slice(i - w, i).reduce((a, b) => a + b, 0) / w : undefined);
    rows.push({ date: d, close: c, high: Math.max(prev, c) * 1.001, low: Math.min(prev, c) * 0.999, volume: m.vol, sma50: avg(50), sma200: avg(200), breadth: m.breadth, skip: m.skip,
      b: { close: c, sma50: avg(50), sma200: avg(200) } });
    d = nextWeekday(d);
  });
  return rows;
}
const up = (n: number, pct = 0.3) => Array.from({ length: n }, (_, i) => ({ pct, vol: 100 + (i % 7), breadth: 65 }));

// ---- Review finding 1: follow-through day must belong to THIS correction ----
test('FTD: an old follow-through in a long uptrend no longer lifts the first Red back to Yellow', () => {
  // 260 sessions of uptrend with one +1.5% higher-volume day early (a "follow-through" by v9's whole-series low), then a 25% fall
  const moves = [...up(12), { pct: 1.5, vol: 400, breadth: 65 }, ...up(250), ...Array.from({ length: 40 }, (_, i) => ({ pct: -1.2, vol: 90 - i * 0.1, breadth: 30 }))];
  const rows = build(moves);
  const v9 = regimeFrom(rows, { v9: true }); const fixed = regimeFrom(rows);
  assert.ok(v9 && !v9.incomplete && fixed && !fixed.incomplete);
  assert.equal(v9.sma, 0); assert.equal(fixed.sma, 0); // trend is Red for both
  assert.equal(v9.lv, 1);       // v9: stale follow-through lifts Red to Yellow (the bug)
  assert.equal(fixed.lv, 0);    // rules: no follow-through in THIS correction, so Red stays Red
  assert.equal(fixed.analysis.status, 'none');
});
test('FTD: a real follow-through inside the correction still lifts Red to Yellow', () => {
  const fall = Array.from({ length: 40 }, (_, i) => ({ pct: -1.2, vol: 90, breadth: 30 }));
  // after the low: day 1 = close above prior high, then day 4+ up 1.25% on higher volume
  const rally = [{ pct: 2.0, vol: 95, breadth: 30 }, { pct: 0.4, vol: 96, breadth: 30 }, { pct: 0.3, vol: 97, breadth: 30 }, { pct: 1.6, vol: 130, breadth: 30 }];
  const rows = build([...up(260), ...fall, ...rally]);
  const r = regimeFrom(rows);
  assert.ok(r && !r.incomplete);
  assert.equal(r.sma, 0);
  assert.equal(r.analysis.status, 'active');
  assert.equal(r.lv, 1);
});
test('FTD: leaving the correction (close back above the 60-session high it was armed under) clears the follow-through state', () => {
  const fall = Array.from({ length: 40 }, () => ({ pct: -1.2, vol: 90, breadth: 30 }));
  const rally = [{ pct: 2.0, vol: 95, breadth: 30 }, { pct: 0.4, vol: 96, breadth: 30 }, { pct: 0.3, vol: 97, breadth: 30 }, { pct: 1.6, vol: 130, breadth: 30 }];
  const recover = Array.from({ length: 120 }, () => ({ pct: 0.9, vol: 100, breadth: 70 }));
  const r = regimeFrom(build([...up(260), ...fall, ...rally, ...recover]));
  assert.ok(r && !r.incomplete);
  assert.equal(r.analysis.status, 'none');
});

// ---- Review finding 2: skip days are not the volume baseline ----
test('distribution volume: a skip day (inflated expiry volume) is not the baseline for the next session', () => {
  const mk = (d: string, close: number, volume: number, skip = false): TrackerRow => ({ date: d, close, high: close, low: close, volume, skip });
  const rows = [mk('2026-01-01', 100, 10), mk('2026-01-02', 100.5, 30, true), mk('2026-01-05', 100.0, 12)];
  // 01-05 is down 0.5% on 12 vs 10 (last normal session): a distribution day. v9 compared with the skip day's 30 and missed it.
  assert.deepEqual(analyze(rows).dist.map((d) => d.date), ['2026-01-05']);
  assert.deepEqual(analyze(rows, { v9: true }).dist.map((d) => d.date), []);
});

// ---- Review finding 3: sessions, not rows or weekdays ----
const cal = makeCalendar(['2026-10-02']);
test('calendar: sessions skip weekends and holidays; addSessions and prevSession agree', () => {
  assert.equal(cal.sessionsBetween('2026-10-01', '2026-10-05'), 1);       // Thu -> Mon: Fri 2 Oct is a holiday
  assert.equal(WEEKDAYS.sessionsBetween('2026-10-01', '2026-10-05'), 2);  // v9 count
  assert.equal(cal.addSessions('2026-10-01', 1), '2026-10-05');
  assert.equal(cal.prevSession('2026-10-05'), '2026-10-01');
  assert.equal(cal.isSession('2026-10-02'), false); assert.equal(cal.sessionsBetween('2026-10-05', '2026-10-05'), 0);
});
test('calendar file: 16 India and 10 US holidays, all on weekdays, sorted, no duplicates', () => {
  const f = JSON.parse(readFileSync('data/calendar/markets-2026.json', 'utf8'));
  assert.equal(f.india.holidays.length, 16); assert.equal(f.us.holidays.length, 10);
  for (const m of ['india', 'us']) {
    const h: string[] = f[m].holidays;
    assert.deepEqual([...h].sort(), h); assert.equal(new Set(h).size, h.length);
    for (const d of h) assert.ok(![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()), m + ' ' + d + ' is a weekend');
  }
  assert.ok(f.india.holidays.includes('2026-10-02')); // Gandhi Jayanti, seen in the live feed
});
test('breadth confirmation window counts sessions, so missing tracker rows do not shorten it', () => {
  const fall = Array.from({ length: 40 }, () => ({ pct: -1.2, vol: 90, breadth: 30 }));
  const rally = [{ pct: 2.0, vol: 95, breadth: 30 }, { pct: 0.4, vol: 96, breadth: 30 }, { pct: 0.3, vol: 97, breadth: 30 }, { pct: 1.6, vol: 130, breadth: 30 }];
  const base = build([...up(260), ...fall, ...rally]);
  const tailOf = (n: number) => build(Array.from({ length: n }, () => ({ pct: 0.1, vol: 100, breadth: 30 })), nextWeekday(base[base.length - 1].date), base[base.length - 1].close);
  const sparse = [...base, ...tailOf(12).filter((_, i) => i % 3 !== 2)]; // 12 sessions passed, only 8 rows stored
  assert.equal(sparse.length - base.length, 8);
  assert.equal(analyze(sparse).status, 'failed'); // 10 sessions without breadth above 50
  assert.equal(analyze([...base, ...tailOf(8)]).status, 'active'); // 8 sessions: still waiting
});

// ---- calendar in the exit rules ----
import { evaluate, type OpenTrade } from '../src/engine/exits.ts';
const T = (over: Partial<OpenTrade> = {}): OpenTrade => ({ setup: '1', entryDate: '2026-09-30', stop0: 95, stop: 95, pivot: 100, lots: [{ shares: 600, price: 100 }], sells: [], maxClose: 100, addShares: 400, gttPlaced: true, ...over });
test('rule 3 and rule 8 count sessions: a holiday does not count as a session', () => {
  // entered Wed 30 Sep; on Tue 6 Oct that is 3 sessions with 2 Oct a holiday (4 by weekdays): rule 3 still applies
  const closeBelow = (c: typeof cal | typeof WEEKDAYS) => evaluate(T(), { close: 98 }, '2026-10-06', 'india', false, c).acts.some((a) => a.r.startsWith('Rule 3'));
  assert.equal(closeBelow(cal), true); assert.equal(closeBelow(WEEKDAYS), false);
  // results on Tue 6 Oct seen from Thu 1 Oct: 2 sessions with the holiday (3 by weekdays), so rule 8 fires only with the calendar
  const r8 = (c: typeof cal | typeof WEEKDAYS) => evaluate(T({ resultsDate: '2026-10-06', entryDate: '2026-09-10' }), { close: 101 }, '2026-10-01', 'india', false, c).acts.some((a) => a.r.startsWith('Rule 8'));
  assert.equal(r8(cal), true); assert.equal(r8(WEEKDAYS), false);
});

// ---- C-35 hybrid: arm at an 8% fall from the 60-session high OR trend Red; disarm above that high ----
const fastDrop = Array.from({ length: 10 }, () => ({ pct: -1.0, vol: 90, breadth: 30 })); // about -9.6%, 50 and 200 SMA far below price
const rallyUp = [{ pct: 2.0, vol: 95, breadth: 30 }, { pct: 0.4, vol: 96, breadth: 30 }, { pct: 0.3, vol: 97, breadth: 30 }, { pct: 1.6, vol: 130, breadth: 30 }];
test('C-35: an 8% fall arms the tracker even though trend is not Red; the follow-through is recorded but changes nothing', () => {
  const rows = build([...up(260), ...fastDrop, ...rallyUp]);
  const r = regimeFrom(rows);
  assert.ok(r && !r.incomplete);
  assert.notEqual(r.sma, 0);                       // trend is Yellow or Green: above at least one average
  assert.equal(r.analysis.status, 'active');       // tracker armed by the drop found the follow-through
  assert.equal(r.lv, r.sma > 1 ? 1 : r.sma);       // lifts Red only: level is not changed by it (green may only be capped elsewhere)
  assert.ok(!r.notes.some((n) => /follow-through lifts/.test(n)));
});
test('C-35: trend Red alone (dropPct 0) does not arm on the same fast drop', () => {
  const rows = build([...up(260), ...fastDrop, ...rallyUp]);
  const r = regimeFrom(rows, { correction: { dropPct: 0, windowSessions: 60 } });
  assert.ok(r && !r.incomplete);
  assert.equal(r.analysis.status, 'none');
});
test('C-35: closing above the 60-session high disarms and clears the state', () => {
  const r = regimeFrom(build([...up(260), ...fastDrop, ...rallyUp, ...Array.from({ length: 30 }, () => ({ pct: 1.0, vol: 100, breadth: 70 }))]));
  assert.ok(r && !r.incomplete);
  assert.equal(r.analysis.status, 'none');
});
// Hand-built rows: 60 flat sessions at 100, then a low that formed BEFORE the tracker armed (arming by trend Red on the follow-through day).
function seeded(extra: { close: number; low: number; vol: number; sma?: number }[]): TrackerRow[] {
  const rows: TrackerRow[] = []; let d = '2025-01-02';
  const add = (close: number, low: number, vol: number, sma?: number) => { rows.push({ date: d, close, high: close * 1.001, low, volume: vol, sma50: sma, sma200: sma, breadth: 30 }); d = nextWeekday(d); };
  for (let i = 0; i < 60; i++) add(100, 100, 100);
  extra.forEach((e) => add(e.close, e.low, e.vol, e.sma));
  return rows;
}
const preLow = [
  { close: 96, low: 93, vol: 90 },     // the correction low (intraday 93), before arming
  { close: 97, low: 96.5, vol: 91 },   // day 1: closes above the previous high
  { close: 96.8, low: 96.4, vol: 92 }, { close: 96.9, low: 96.4, vol: 93 },
  { close: 98.2, low: 96.9, vol: 130, sma: 99 }, // day 4+, +1.3% on higher volume; trend reads Red here, so the tracker arms on this very day
];
test('C-35 seeding: the low is the lowest low since the 60-session closing high, and a follow-through on the arming day is valid', () => {
  const a = analyze(seeded(preLow));
  assert.equal(a.status, 'active');
  assert.equal(a.ftd!.rallyLow, 93);                       // the true low, not a low taken after arming
  assert.equal(a.ftd!.lowDate, seeded(preLow)[60].date);   // formed 4 sessions before arming
});
test('C-35 seeding: the rally-low failure test uses the seeded low', () => {
  const rows = seeded([...preLow, { close: 94.5, low: 94, vol: 100, sma: 99 }]);
  assert.equal(analyze(rows).status, 'active');            // 94.5 is under the post-arming lows but above the true low 93: still active
});
test('C-35 seeding: a new low after arming replaces the seeded one and restarts the count', () => {
  const rows = seeded([...preLow, { close: 92, low: 91, vol: 100, sma: 99 }]);
  const a = analyze(rows);
  assert.equal(a.status, 'failed');                        // closed below the rally low 93
  const more = analyze(seeded([...preLow, { close: 92, low: 91, vol: 100, sma: 99 }, { close: 92.5, low: 91.5, vol: 101, sma: 99 }]));
  assert.equal(more.status, 'failed');
});
