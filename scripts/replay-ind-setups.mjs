// C-64 India setups and exits replay. Pre-registered in the Engine Rules change log (18 Oct 2026) before running.
// Every qualified, non-extended name in a top-ranked group is traded on each desk geometry present (breakout, 20 EMA pullback, 50 SMA pullback) with the scan's own trigger and stop; the desk's exit rules run at daily-close resolution.
// Light fixed to green; today's industry map; results timing not used. Usage: node --max-old-space-size=8000 scripts/replay-ind-setups.mjs [--limit=N]
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { runScan, buildHistories } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { tierCost } from '../src/backtest/ind-base.ts';
import { SETUPS } from '../src/engine/setups.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const COSTX = Number(arg('costx', 1)), SUF = COSTX === 1 ? '' : `-cost${COSTX}x`;   // C-67: --costx=2 doubles every cost; separate output files
const LIMIT = +arg('limit', 0), FROM = arg('from', '2021-01-04'), HOLD = 20, MAXHOLD = 60;
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const sel = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = { ...(existsSync('data/india/corp-action-overrides-hist.json') ? R('data/india/corp-action-overrides-hist.json') : {}), ...(existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {}) };
const res = resolveHistory(sel, actions, ov);
const industry = R('data/india/segments.json').industry ?? {}, allowed = new Set(Object.keys(industry)), types = new Map([...allowed].map((s) => [s, 'CS']));
const days = toDays(sel), dates = days.map((d) => d.date), T = days.length;
const FH = buildHistories(days, res.splits, allowed);       // fully adjusted: realised returns only
const RD = R('data/india/results-dates.json'), syms = [...allowed].filter((s) => FH.series.has(s));
const first = (d) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
const cc = (s, i) => { const v = FH.series.get(s)?.c[i]; return v > 0 ? v : NaN; }, ret = (s, a, b) => cc(s, b) / cc(s, a) - 1;
const mc = new Map(); const mkt = (a, b) => { const k = a + ':' + b; if (mc.has(k)) return mc.get(k); let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } const v = n > 30 ? s / n : NaN; mc.set(k, v); return v; };
const mk = new Float64Array(T).fill(NaN); mk[0] = 100; for (let i = 1; i < T; i++) { const m = mkt(i - 1, i); mk[i] = mk[i - 1] * (1 + (m === m ? m : 0)); }
const sma = (a, i, n) => { let s = 0, k = 0; for (let j = i - n + 1; j <= i; j++) if (a[j] > 0) { s += a[j]; k++; } return k >= 0.8 * n ? s / k : NaN; };
const EV = {}; for (const s of syms) EV[s] = (RD.dates[s] || []).map((d) => ({ E: first(d), d })).filter((e) => Math.abs(new Date(dates[e.E] ?? '2100-01-01') - new Date(e.d)) <= 4 * 864e5 || e.E >= T);
const dv20 = (s, t) => { const x = FH.series.get(s); let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (x.c[i] > 0 && x.v[i] === x.v[i]) { a += x.c[i] * x.v[i]; n++; } return n ? a / n : 0; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const wkKey = (d) => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return y * 100 + 1 + Math.round(((t - j) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); };
const lastOfWeek = dates.map((d, i) => i === T - 1 || wkKey(dates[i + 1]) !== wkKey(d));
const VARS = { desk: {}, noThirds: { thirds: false }, noTimeStop: { timeStop: false }, noFailBrk: { failBrk: false }, noEmaTrail: { emaTrail: false }, fixed20: { fixed: true } };
function simulate(sym, t, setup, costPct, o = {}) {
  const { thirds = true, timeStop = true, failBrk = true, emaTrail = true, fixed = false } = o;
  const s = FH.series.get(sym); if (!s) return null;
  const e = t + 1; if (e >= T || !(s.h[e] >= setup.trigger) || !(s.l[e] <= setup.limit)) return null;
  const E = setup.trigger, Rk = E - setup.stop; if (!(Rk > 0)) return null;
  const ema = new Float64Array(T).fill(NaN); { let v = NaN; for (let i = Math.max(0, e - 60); i < T; i++) { if (!(s.c[i] > 0)) continue; v = v !== v ? s.c[i] : v + (2 / 21) * (s.c[i] - v); ema[i] = v; } }
  let stop = setup.stop, left = 1, pnl = 0, maxClose = -Infinity, thirdSold = false, extSold = false, reason = 'end', pending = null, exitIdx = null;
  const breakout = setup.id === '1';
  const sell = (frac, price) => { pnl += frac * (price - E) / Rk; left -= frac; };
  for (let i = e; i < T && i <= e + MAXHOLD; i++) {
    if (!(s.c[i] > 0)) continue;
    if (pending && i > e) { const p = pending; pending = null; if (p.kind === 'all') { sell(left, s.c[i]); reason = p.why; exitIdx = i; break; } if (p.kind === 'third') { sell(Math.min(left, 1 / 3), s.c[i]); if (p.why === 'r5') { thirdSold = true; stop = Math.max(stop, E); } else extSold = true; } }
    if (s.l[i] <= stop) { sell(left, stop); reason = stop >= E ? 'stop-at-entry' : 'stop'; exitIdx = i; break; }
    const c = s.c[i], gain = (c - E) / Rk, sessions = i - e + 1; maxClose = Math.max(maxClose, c);
    if (fixed) { if (sessions >= 20) { sell(left, c); reason = 'fixed20'; exitIdx = i; break; } exitIdx = i; continue; }
    if (failBrk && breakout && sessions <= 3 && c < setup.basis) { pending = { kind: 'all', why: 'r3-failed-breakout' }; continue; }
    if (timeStop && sessions >= 10 && maxClose < E + Rk) { pending = { kind: 'all', why: 'r4-time-stop' }; continue; }
    if (sessions < 35) { if (emaTrail && ema[i] === ema[i] && c < ema[i]) { pending = { kind: 'all', why: 'r6-trail-20ema' }; continue; } }
    else if (lastOfWeek[i]) { const wc = []; for (let j = i; j >= 0 && wc.length < 10; j--) if (lastOfWeek[j] && s.c[j] > 0) wc.push(s.c[j]); if (wc.length === 10 && c < mean(wc)) { pending = { kind: 'all', why: 'r6-trail-10wk' }; continue; } }
    if (thirds && !thirdSold && gain >= 2) { pending = { kind: 'third', why: 'r5' }; continue; }
    if (thirds && !extSold && ema[i] === ema[i] && c >= 1.2 * ema[i]) { pending = { kind: 'third', why: 'r7' }; continue; }
    exitIdx = i;
  }
  if (left > 1e-9) { let last = -1; for (let i = Math.min(T - 1, e + MAXHOLD); i >= e; i--) if (s.c[i] > 0) { last = i; break; } if (last < 0) return null; sell(left, s.c[last]); if (reason === 'end') reason = last >= e + MAXHOLD ? 'max-hold' : 'data-end'; exitIdx = last; }
  return { R: pnl - (costPct * E) / Rk, held: (exitIdx ?? e) - e + 1, reason, width: Rk / E };
}
const start = Math.max(first(FROM), 260); let nights = []; for (let t = start; t + MAXHOLD + 2 < T; t++) nights.push(t); if (LIMIT) nights = nights.slice(0, LIMIT);
const trades = [], cands = {}, lastEntry = new Map(); let prev = {}; const t0 = Date.now();
const roomOk = (r) => r === null || r >= 3;
for (const [ni, t] of nights.entries()) {
  const hist = asOfHistories(days, t, res, allowed), diagRows = [];
  const out = runScan({ hist, types, sic: new Map(), light: 'green', prev, settings: INDIA_SCAN, version: INDIA_SCAN_VERSION, groupOf: (s) => industry[s] ?? null, setupsByLight: INDIA_SETUPS, diagRows });
  prev = out.state; const top = new Set(out.groups.filter((g) => g.passes).map((g) => g.group));
  for (const r of diagRows) {
    if (!top.has(industry[r.sym]) || r.path !== 'main') continue;
    const opts = [['1', r.geoBreakout && r.tight, r.brkTrig, r.brkStopAt, r.brkWidth, r.brkCap, r.brkRoomR], ['2', r.geoPull20, r.p20Trig, r.p20StopAt, r.p20Width, r.p20Cap, r.p20RoomR], ['4', r.geoPull50, r.p50Trig, r.p50StopAt, r.p50Width, r.p50Cap, r.p50RoomR]];
    for (const [id, geo, trig, stopAt, width, cap, room] of opts) {
      if (!geo || !(trig > 0) || !(stopAt > 0) || !(width > 0) || width > 1.5 * cap) continue;
      const key = r.sym + id; if (lastEntry.has(key) && t - lastEntry.get(key) < 20) continue;
      const cls = width <= cap ? (roomOk(room) ? 'valid' : 'lowRoom') : 'tooWide';
      cands[id + cls] = (cands[id + cls] || 0) + 1; lastEntry.set(key, t);
      const setup = { id, trigger: trig, stop: stopAt, limit: trig * (1 + SETUPS[id].lim / 100), basis: id === '1' ? trig / (1 + SETUPS[id].trig / 100) : trig };
      const cost = COSTX * tierCost(dv20(r.sym, t)), v = {}; let filled = true;
      for (const [k, o] of Object.entries(VARS)) { const x = simulate(r.sym, t, setup, cost, o); if (!x) { filled = false; break; } v[k] = { R: x.R, held: x.held, reason: x.reason, pct: x.R * x.width }; }
      if (filled) trades.push({ s: r.sym, id, cls, d: dates[t], y: dates[t].slice(0, 4), ym: dates[t].slice(0, 7), width, room, v });
    }
  }
  if (ni % 100 === 0) console.error(`night ${ni}/${nights.length} ${dates[t]} trades ${trades.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
// ---- analysis
const pct = (v) => (v * 100).toFixed(2) + '%', f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const SU = (a, k = 'desk') => { const R = a.map((x) => x.v[k].R); return { n: a.length, R: mean(R), med: med(R), win: R.filter((v) => v > 0).length / (R.length || 1), pct: mean(a.map((x) => x.v[k].pct)), held: mean(a.map((x) => x.v[k].held)) }; };
const line = (n, a, k) => { const s = SU(a, k); return `${n.padEnd(34)} n=${String(s.n).padStart(5)} meanR ${f2(s.R).padStart(6)} medR ${f2(s.med).padStart(6)} win ${(s.win * 100).toFixed(0)}% ret/trade ${pct(s.pct).padStart(7)} held ${s.held.toFixed(1)}`; };
console.log(`nights ${nights.length}, filled trades ${trades.length}; candidates by class`, JSON.stringify(cands));
const rep = {};
console.log('\nQ1 SETUPS (valid trades, desk exits):'); const valid = trades.filter((x) => x.cls === 'valid');
for (const id of ['1', '2', '4']) { const a = valid.filter((x) => x.id === id), c = cands[id + 'valid'] || 0; console.log(line(`setup ${id} ${SETUPS[id].short}`, a), `| filled ${(100 * a.length / (c || 1)).toFixed(0)}% of ${c}`); const yrs = [...new Set(a.map((x) => x.y))].sort(); console.log('    by year:', yrs.map((y) => `${y}:${f2(SU(a.filter((x) => x.y === y)).R)} (n${a.filter((x) => x.y === y).length})`).join(' ')); rep['setup' + id] = SU(a); }
console.log(line('all valid', valid)); rep.valid = SU(valid);
const clusterT = (diffs) => { const m = {}; for (const d of diffs) (m[d.ym] ||= []).push(d.x); const v = Object.values(m).map(mean); return v.length > 2 ? mean(v) / (sd(v) / Math.sqrt(v.length)) : NaN; };
console.log('\nQ2 STOP-WIDTH CAP (room ok): valid vs too wide (cap < width <= 1.5 cap)');
for (const id of ['1', '2', '4', 'all']) { const a = trades.filter((x) => (id === 'all' || x.id === id) && x.cls === 'valid'), b = trades.filter((x) => (id === 'all' || x.id === id) && x.cls === 'tooWide'); const A = SU(a), B = SU(b); console.log(`setup ${id}: valid n=${A.n} meanR ${f2(A.R)} win ${(A.win * 100).toFixed(0)}% ret ${pct(A.pct)} | tooWide n=${B.n} meanR ${f2(B.R)} win ${(B.win * 100).toFixed(0)}% ret ${pct(B.pct)} -> ${B.n >= 100 && B.R <= A.R - 0.15 ? 'CAP SUPPORTED' : 'cap not shown to matter'}`); rep['cap' + id] = { valid: A, tooWide: B }; }
console.log('\nQ3 ROOM RULE (width ok): room >= 3R vs room < 3R');
for (const id of ['1', '2', '4', 'all']) { const a = trades.filter((x) => (id === 'all' || x.id === id) && x.cls === 'valid'), b = trades.filter((x) => (id === 'all' || x.id === id) && x.cls === 'lowRoom'); const A = SU(a), B = SU(b); console.log(`setup ${id}: room ok n=${A.n} meanR ${f2(A.R)} win ${(A.win * 100).toFixed(0)}% | low room n=${B.n} meanR ${f2(B.R)} win ${(B.win * 100).toFixed(0)}% -> ${B.n >= 100 && B.R <= A.R - 0.15 ? 'ROOM RULE SUPPORTED' : 'room rule not shown to matter'}`); rep['room' + id] = { ok: A, low: B }; }
console.log('\nQ4 EXITS (paired on valid trades, change in mean R against desk exits; ret/trade shown):');
const yrsAll = [...new Set(valid.map((x) => x.y))].sort();
for (const grp of ['all', '1', '2', '4']) { const a = grp === 'all' ? valid : valid.filter((x) => x.id === grp);
  for (const k of Object.keys(VARS).slice(1)) { const d = a.map((x) => ({ ym: x.ym, y: x.y, x: x.v[k].R - x.v.desk.R })), dm = mean(d.map((q) => q.x)), t = clusterT(d), ys = yrsAll.map((y) => mean(d.filter((q) => q.y === y).map((q) => q.x))).filter((v) => v === v), good = ys.filter((v) => v > 0).length;
    const ok = dm >= 0.1 && good >= 4 && t > 2; console.log(`setup ${grp.padEnd(3)} ${k.padEnd(11)} dR ${f2(dm).padStart(6)} (meanR ${f2(SU(a, k).R)} vs ${f2(SU(a).R)}) ret ${pct(SU(a, k).pct)} vs ${pct(SU(a).pct)} t ${t.toFixed(2)} years better ${good}/${ys.length} -> ${ok ? 'SUPPORTED' : 'no'}`); rep[`exit_${grp}_${k}`] = { dR: dm, t, good, ok }; } }
mkdirSync('data/replay', { recursive: true }); writeFileSync(`data/replay/ind-setups${SUF}.json`, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), nights: nights.length, cands, rep }, null, 1));
writeFileSync(`data/replay/ind-setups-trades${SUF}.json`, JSON.stringify(trades) + '\n');
