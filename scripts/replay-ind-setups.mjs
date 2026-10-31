// C-64 India setups and exits replay. Pre-registered in the Engine Rules change log (18 Oct 2026) before running.
// Every qualified, non-extended name in a top-ranked group is traded on each desk geometry present (breakout, 20 EMA pullback, 50 SMA pullback) with the scan's own trigger and stop; the desk's exit rules run at daily-close resolution.
// Light fixed to green; today's industry map; results timing not used. Usage: node --max-old-space-size=8000 scripts/replay-ind-setups.mjs [--limit=N]
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { runScan, buildHistories } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { tierCost } from '../src/backtest/ind-base.ts';
import { deskSim, dateCalendar } from '../src/backtest/desk-sim.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { SETUPS } from '../src/engine/setups.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const EXITS = arg('exits', 'port'), COSTX = Number(arg('costx', 1)), SUF = (COSTX === 1 ? '' : `-cost${COSTX}x`) + (EXITS === 'live' ? '-live' : '') + (process.argv.includes('--oos') ? '-oos' : '');   // C-67: --costx=2 doubles every cost; separate output files
const OOS = process.argv.includes('--oos');   // C-118 test (b): the same replay on 2011-2019 (signals), 2010 warm-up, today's industry map; results dates do not exist before 2020, so rule 8 cannot fire
const LIMIT = +arg('limit', 0), FROM = arg('from', OOS ? '2011-01-03' : '2021-01-04'), HOLD = 20, MAXHOLD = 60;
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const D = OOS ? loadIndia('data/india', { pre2020: true, to: '2020-04-30' }) : loadIndia(), { dates, T, days, res, industry, allowed, types, FH, RD, syms, first, cc, ret, mkt, mk, sma, dv20 } = D;   // C-69: the shared loader
const EV = {}; for (const s of syms) EV[s] = (RD.dates[s] || []).map((d) => ({ E: first(d), d })).filter((e) => Math.abs(new Date(dates[e.E] ?? '2100-01-01') - new Date(e.d)) <= 4 * 864e5 || e.E >= T);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const wkKey = (d) => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return y * 100 + 1 + Math.round(((t - j) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); };
const lastOfWeek = dates.map((d, i) => i === T - 1 || wkKey(dates[i + 1]) !== wkKey(d));
const VARS = { desk: {}, ...(EXITS === 'live' ? { live: { live: true }, liveNoR8: { live: true, rule8: false } } : {}), noThirds: { thirds: false }, noTimeStop: { timeStop: false }, noFailBrk: { failBrk: false }, noEmaTrail: { emaTrail: false }, fixed20: { fixed: true } };
const CAL = dateCalendar(dates);
function simulate(sym, t, setup, costPct, o = {}) {
  if (o.live) { const s = FH.series.get(sym); if (!s) return null; const e = t + 1; if (e >= T || !(s.h[e] >= setup.trigger) || !(s.l[e] <= setup.limit)) return null; const ev = (RD.dates[sym] || []).filter((d) => d >= dates[e]).sort()[0]; const r = deskSim({ dates, c: s.c, h: s.h, l: s.l, e, trigger: setup.trigger, stop: setup.stop, setup: setup.id, pivot: setup.basis, resultsDate: ev, cal: CAL, rules: { rule8: o.rule8 !== false } }); if (!r) return null; const Rk = setup.trigger - setup.stop; return { R: r.R - (costPct * setup.trigger) / Rk, held: r.held, reason: r.reason, width: Rk / setup.trigger }; }
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
const start = Math.max(first(FROM), 260); let nights = []; for (let t = start; t + MAXHOLD + 2 < T; t++) nights.push(t); if (OOS) nights = nights.filter((t) => dates[t] <= '2019-12-31'); if (LIMIT) nights = nights.slice(0, LIMIT);
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
      if (filled) trades.push({ s: r.sym, g: industry[r.sym], ei: t + 1, id, cls, d: dates[t], y: dates[t].slice(0, 4), ym: dates[t].slice(0, 7), width, room, v });
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
if (EXITS === 'live') {
  console.log('\nC-68 LIVE EXITS (evaluate() in src/engine/exits.ts) beside the port, same trades, net of tiered cost:');
  const out = {};
  for (const [name, a] of [['valid all', valid], ['valid setup 1', valid.filter((x) => x.id === '1')], ['valid setup 2', valid.filter((x) => x.id === '2')], ['valid setup 4', valid.filter((x) => x.id === '4')], ['room under 3R', trades.filter((x) => x.cls === 'lowRoom')], ['stop too wide', trades.filter((x) => x.cls === 'tooWide')]]) {
    out[name] = {}; for (const k of ['desk', 'live', 'liveNoR8']) { const q = SU(a, k); out[name][k] = q; console.log(`${name.padEnd(16)} ${k.padEnd(9)} n=${String(q.n).padStart(4)} meanR ${f2(q.R).padStart(6)} win ${(q.win * 100).toFixed(0)}% ret/trade ${pct(q.pct).padStart(7)} held ${q.held.toFixed(1)}`); }
  }
  const rs = {}; for (const x of valid) rs[x.v.live.reason] = (rs[x.v.live.reason] || 0) + 1; console.log('live exit reasons (valid):', JSON.stringify(rs));
  rep.liveVsPort = out;
}
if (OOS) {   // C-118 (b): pass rule on the valid desk trades with the live exits; excess = trade return minus the equal-weight market over the same sessions (today's survivors, so the market is flattered and the excess understated)
  const { bootMean } = await import('../src/backtest/ind-base.ts'), { formatReport } = await import('../src/backtest/report.ts');
  const k = EXITS === 'live' ? 'live' : 'desk', tr = [...valid].sort((a, b) => (a.d < b.d ? -1 : 1)), mret = (x) => { const a = mk[x.ei], b = mk[Math.min(T - 1, x.ei + x.v[k].held - 1)]; return b / a - 1; };
  const ex = tr.map((x) => x.v[k].pct - mret(x)), [lo, hi] = bootMean(ex), groups = [...new Set(tr.map((x) => x.g))];
  const dropped = groups.map((g) => ({ g, m: mean(tr.filter((x) => x.g !== g).map((x, i) => x.v[k].pct - mret(x))) , n: tr.filter((x) => x.g === g).length })), bestG = groups.map((g) => ({ g, sum: tr.filter((x) => x.g === g).reduce((a, x) => a + x.v[k].pct - mret(x), 0) })).sort((a, b) => b.sum - a.sum)[0]?.g;
  const exDrop = tr.filter((x) => x.g !== bestG).map((x) => x.v[k].pct - mret(x));
  const byYear = {}; tr.forEach((x, i) => (byYear[x.y] ??= []).push(ex[i])); const yearsPos = Object.values(byYear).filter((v) => mean(v) > 0).length;
  const crit = { meanExcessAboveZero: mean(ex) > 0, ciLowAboveZero: lo > 0, aboveZeroAfterDroppingBestGroup: mean(exDrop) > 0, yearsPositiveAtLeast6of9: yearsPos >= 6 && Object.keys(byYear).length === 9 };
  const bySetup = Object.fromEntries(['1', '2', '4'].map((id) => [id, { n: tr.filter((x) => x.id === id).length, meanR: SU(tr.filter((x) => x.id === id), k).R }]));
  const recs = tr.map((x, i) => ({ sym: x.s, entry: x.d, group: x.g, regime: 'green-fixed', net: { 0: x.v[k].pct }, mkt: { 0: mret(x) } }));
  const oos = { exits: EXITS, trades: tr.length, perYear: 'see byYear', meanExcess: mean(ex), ci90: [lo, hi], bestGroupDropped: bestG, meanExcessAfterDrop: mean(exDrop), yearsWithTrades: Object.keys(byYear).length, yearsPositive: yearsPos, byYear: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, meanExcess: mean(v) }])), bySetup, criteria: crit, pass: Object.values(crit).every(Boolean), caveats: ['survivor-biased: groups from today\'s industry map', 'light fixed to green', 'no results dates before 2020: rule 8 off', 'market = equal-weight of today\'s symbols'] };
  writeFileSync('data/replay/c118-b-oos.json', JSON.stringify(oos, null, 1) + '\n'); writeFileSync('docs/replay/C118-B-REPORT.md', formatReport('C-118 test (b): C-64 desk setups with live exits, India signals 2011-2019', recs, { market: 'india', survivorBiased: true, pricesAdjusted: true, sweepSize: 1, window: '2011-01 to 2019-12' }, { splitHorizon: 0, horizons: [0] }) + '\n');
  console.log('C-118 (b)', JSON.stringify(oos, null, 1));
}
mkdirSync('data/replay', { recursive: true }); writeFileSync(`data/replay/ind-setups${SUF}.json`, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), nights: nights.length, cands, rep }, null, 1));
writeFileSync(`data/replay/ind-setups-trades${SUF}.json`, JSON.stringify(trades) + '\n');
