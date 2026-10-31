// C-125 (US part): the US scan's three setups traded on every night with the desk's live exits, grouped as the India replay groups them (valid / stop too wide / room under 3R), to see what the two gates remove.
// Built from replay-ind-setups.mjs: same runScan diagnostics, same fill rule (next session reaches the trigger and the limit), same deskSim live exits, one entry per symbol and setup per 20 sessions, tiered US cost. Light fixed to Yellow, SIC groups from today's file, no results-date rule.
// SURVIVOR-BIASED UPWARD. Usage: node --max-old-space-size=7000 scripts/replay-us-setups.mjs [--limit=N]
import { writeFileSync, mkdirSync } from 'node:fs';
import { runScan } from '../src/ingest/us-scan.ts';
import { sicGroup } from '../src/ingest/us-scan-settings.ts';
import { loadUs, truncatedHist, usCost } from '../src/backtest/us-loader.ts';
import { deskSim, dateCalendar } from '../src/backtest/desk-sim.ts';
import { SETUPS } from '../src/engine/setups.ts';
const LIMIT = +(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 0), MAXHOLD = 60, LIGHT = 'yellow';
const D = loadUs(), { dates, N, types, sic, hist } = D, CAL = dateCalendar(dates);
const t0i = D.first('2018-01-01'); let t1i = N - 1; while (dates[t1i] > '2025-09-30') t1i--;
let nights = []; for (let t = t0i; t <= t1i && t + MAXHOLD + 2 < N; t++) nights.push(t); if (LIMIT) nights = nights.slice(0, LIMIT);
console.error(`sessions ${N}, nights ${nights.length} (${dates[nights[0]]} to ${dates[nights[nights.length - 1]]}), data ${D.snapshot.hash}`);
const dv20 = (s, t) => { let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) { a += s.c[i] * s.v[i]; n++; } return n ? a / n : 0; };
const roomOk = (r) => r === null || r >= 3;
function simulate(sym, t, setup, costPct) {
  const s = hist.series.get(sym); if (!s) return null; const e = t + 1;
  if (e >= N || !(s.h[e] >= setup.trigger) || !(s.l[e] <= setup.limit)) return null;
  const r = deskSim({ dates, c: s.c, h: s.h, l: s.l, e, trigger: setup.trigger, stop: setup.stop, setup: setup.id, pivot: setup.basis, resultsDate: undefined, cal: CAL, rules: { rule8: false } }); if (!r) return null;
  const Rk = setup.trigger - setup.stop; return { R: r.R - (costPct * setup.trigger) / Rk, held: r.held, reason: r.reason, width: Rk / setup.trigger };
}
const trades = [], cands = {}, lastEntry = new Map(); let prev = {}; const t0 = Date.now();
for (const [ni, t] of nights.entries()) {
  const diagRows = [], out = runScan({ hist: truncatedHist(hist, t), types, sic, light: LIGHT, prev, diagRows }); prev = out.state;
  const top = new Set(out.groups.filter((g) => g.passes).map((g) => g.group)), groupOf = (sym) => sicGroup(sic.get(sym));
  for (const r of diagRows) {
    if (!top.has(groupOf(r.sym)) || r.path !== 'main') continue;
    const opts = [['1', r.geoBreakout && r.tight, r.brkTrig, r.brkStopAt, r.brkWidth, r.brkCap, r.brkRoomR], ['2', r.geoPull20, r.p20Trig, r.p20StopAt, r.p20Width, r.p20Cap, r.p20RoomR], ['4', r.geoPull50, r.p50Trig, r.p50StopAt, r.p50Width, r.p50Cap, r.p50RoomR]];
    for (const [id, geo, trig, stopAt, width, cap, room] of opts) {
      if (!geo || !(trig > 0) || !(stopAt > 0) || !(width > 0) || width > 1.5 * cap) continue;
      const key = r.sym + id; if (lastEntry.has(key) && t - lastEntry.get(key) < 20) continue;
      const cls = width <= cap ? (roomOk(room) ? 'valid' : 'lowRoom') : 'tooWide'; cands[id + cls] = (cands[id + cls] || 0) + 1; lastEntry.set(key, t);
      const setup = { id, trigger: trig, stop: stopAt, limit: trig * (1 + SETUPS[id].lim / 100), basis: id === '1' ? trig / (1 + SETUPS[id].trig / 100) : trig };
      const s = hist.series.get(r.sym), x = s ? simulate(r.sym, t, setup, usCost(dv20(s, t))) : null;
      if (x) trades.push({ s: r.sym, g: groupOf(r.sym), ei: t + 1, id, cls, d: dates[t], y: dates[t].slice(0, 4), ym: dates[t].slice(0, 7), width, room, v: { live: { R: x.R, held: x.held, reason: x.reason, pct: x.R * x.width } } });
    }
  }
  if (ni % 100 === 0) console.error(`night ${ni}/${nights.length} ${dates[t]} trades ${trades.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/us-setups-trades-live.json', JSON.stringify(trades) + '\n');
console.log('nights', nights.length, 'filled', trades.length, 'candidates', JSON.stringify(cands));
