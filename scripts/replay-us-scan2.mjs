// C-52: replay of US-SCAN-2 over the stored nights. Criteria: docs/replay/US-SCAN-2-PREREG.md (confirmed and committed before this script was written or run).
// Usage: node scripts/replay-us-scan2.mjs --gate=off|on --regime=hist|yellow --cap=4|0 [--stage2] [--leak] [--out=path] [--limit=N]
//   v2 = --gate=off --regime=hist --cap=4 (all three changes). Ablations switch one change at a time. v1 = --gate=on --regime=yellow --cap=0.
// Entry next close, 20-session hold (stage 1); stage 2 runs the exit rules at daily-close resolution. Scan code is the live scan (src/ingest/us-scan.ts) with the noTightGate switch.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories, runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';
import { regimeFrom, LEVEL_NAME } from '../src/engine/regime.ts';
import { makeCalendar } from '../src/engine/calendar.ts';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const GATE_OFF = arg('gate', 'off') === 'off', REGIME = arg('regime', 'hist'), CAP = +arg('cap', 4);
const STAGE2 = process.argv.includes('--stage2'), LEAK = process.argv.includes('--leak'), LIMIT = +arg('limit', 0);
const TAG = `gate-${GATE_OFF ? 'off' : 'on'}_regime-${REGIME}_cap-${CAP}`;
const OUT = arg('out', `data/replay/us-scan2-${TAG}.json`);
const HOLD = 20, SEED = 20261016, CAPWIN = 20, MAXHOLD = 60;
// tiered round-trip cost by 20-day dollar volume (analyst, pre-registered)
const tierCost = (dv) => (dv >= 100e6 ? 0.002 : dv >= 25e6 ? 0.0035 : 0.006);

const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// ---- load
const dir = 'data/us/grouped';
const files = readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.csv\.gz$/.test(f)).sort();
const tk = JSON.parse(readFileSync('data/us/' + readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop(), 'utf8'));
const types = new Map(); for (const [sym, type] of tk.rows) if (SCAN.types.includes(type)) types.set(sym, type);
const allowed = new Set(types.keys());
const days = [], spy = [];
for (const f of files) {
  const lines = gunzipSync(readFileSync(`${dir}/${f}`)).toString('utf8').split('\n');
  const rows = []; let sp = NaN;
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(','); if (p.length < 5) continue;
    const c = +p[1], h = +p[2], l = +p[3], v = +p[4];
    if (p[0] === 'SPY') sp = c;
    if (allowed.has(p[0]) && c > 0 && h > 0 && l > 0) rows.push([p[0], c, h, l, v]);
  }
  days.push({ date: f.slice(0, 10), rows }); spy.push(sp);
}
const N = days.length, dates = days.map((d) => d.date);
const allSplits = JSON.parse(readFileSync('data/us/splits.json', 'utf8')).rows;
const sic = new Map(JSON.parse(readFileSync('data/us/sic.json', 'utf8')).rows.filter((r) => r[1]).map((r) => [r[0], +r[1]]));
const FIRST = SCAN.quarter * 4, LAST = N - 1 - HOLD - 1;
let nights = []; for (let t = FIRST; t <= LAST; t++) nights.push(t);
if (LIMIT) nights = nights.slice(0, LIMIT);
const fullHist = buildHistories(days, allSplits, allowed);

// ---- regime light from history (live rules, unchanged): tracker rows (SPY, QQQ) plus breadth from the stored bars
const lightByDate = new Map(); let regimeFallbacks = 0, breadthCheck = null;
{
  const sp500 = JSON.parse(readFileSync('data/us/sp500.json', 'utf8')).symbols.filter((s) => fullHist.series.has(s));
  const breadth = new Map();
  for (let i = 49; i < N; i++) { let up = 0, n = 0; for (const s of sp500) { const c = fullHist.series.get(s).c; if (c[i] !== c[i]) continue; let m = 0, k = 0; for (let j = i - 49; j <= i; j++) if (c[j] === c[j]) { m += c[j]; k++; } if (k < 45) continue; n++; if (c[i] > m / k) up++; } if (n > 100) breadth.set(dates[i], Math.round((1000 * up) / n) / 10); }
  const trDir = 'data/us/tracker', tf = readdirSync(trDir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
  const rowsAll = tf.map((f) => ({ ...JSON.parse(readFileSync(`${trDir}/${f}`, 'utf8')), date: f.slice(0, 10) })).map((r) => (breadth.has(r.date) ? { ...r, breadth: breadth.get(r.date) } : r));
  const stored = existsSync('data/us/breadth.json') ? JSON.parse(readFileSync('data/us/breadth.json', 'utf8')) : {};
  const diffs = Object.keys(stored).filter((d) => breadth.has(d)).map((d) => Math.abs(stored[d].pct - breadth.get(d)));
  breadthCheck = { comparedDays: diffs.length, meanAbsDiffPts: diffs.length ? mean(diffs) : null, maxAbsDiffPts: diffs.length ? Math.max(...diffs) : null };
  const hol = []; { const set = new Set(dates); const t0 = Date.parse(rowsAll[0].date), t1 = Date.parse(dates[N - 1]); for (let t = t0; t <= t1; t += 86400000) { const d = new Date(t).toISOString().slice(0, 10), w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6 && !set.has(d)) hol.push(d); } }
  const cal = makeCalendar(hol);
  for (const t of nights) {
    const d = dates[t], idx = rowsAll.findIndex((r) => r.date === d);
    if (idx < 0) { regimeFallbacks++; lightByDate.set(d, 'yellow'); continue; }
    const r = regimeFrom(rowsAll.slice(Math.max(0, idx - 130), idx + 1), { cal });
    if (!r || r.incomplete) { regimeFallbacks++; lightByDate.set(d, 'yellow'); } else lightByDate.set(d, LEVEL_NAME[r.lv]);
  }
}
const lightOf = (t) => (REGIME === 'hist' ? lightByDate.get(dates[t]) : 'yellow');

// ---- helpers for stage 2
const wkKey = (d) => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return y * 100 + 1 + Math.round(((t - j) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); };
const lastOfWeek = dates.map((d, i) => i === N - 1 || wkKey(dates[i + 1]) !== wkKey(d));
function simulate(sym, t, setup, costPct) {
  const s = fullHist.series.get(sym); if (!s) return null;
  const e = t + 1; if (e >= N || !(s.h[e] >= setup.trigger) || !(s.l[e] <= setup.limit)) return null;     // filled at the trigger on the next session, within the limit
  const E = setup.trigger, R = E - setup.stop; if (!(R > 0)) return null;
  const ema = new Float64Array(N).fill(NaN); { let v = NaN; for (let i = Math.max(0, e - 60); i < N; i++) { if (!(s.c[i] > 0)) continue; v = v !== v ? s.c[i] : v + (2 / 21) * (s.c[i] - v); ema[i] = v; } }
  let stop = setup.stop, left = 1, pnl = 0, maxClose = -Infinity, thirdSold = false, extSold = false, reason = 'end', pending = null, exitIdx = null;
  const breakout = setup.id === '1' || setup.id === '1ipo';
  const sell = (frac, price) => { pnl += frac * (price - E) / R; left -= frac; };
  for (let i = e; i < N && i <= e + MAXHOLD; i++) {
    if (!(s.c[i] > 0)) continue;
    if (pending && i > e) {                       // signals from the evening before are executed at this session's close
      const p = pending; pending = null;
      if (p.kind === 'all') { sell(left, s.c[i]); reason = p.why; exitIdx = i; break; }
      if (p.kind === 'third') { sell(Math.min(left, 1 / 3), s.c[i]); if (p.why === 'r5') { thirdSold = true; stop = Math.max(stop, E); } else extSold = true; }
    }
    if (s.l[i] <= stop) { sell(left, stop); reason = stop >= E ? 'stop-at-entry' : 'stop'; exitIdx = i; break; }
    const c = s.c[i], gain = (c - E) / R, sessions = i - e + 1; maxClose = Math.max(maxClose, c);
    if (breakout && sessions <= 3 && c < setup.basis) { pending = { kind: 'all', why: 'r3-failed-breakout' }; continue; }
    if (sessions >= 10 && maxClose < E + R) { pending = { kind: 'all', why: 'r4-time-stop' }; continue; }
    if (sessions < 35) { if (ema[i] === ema[i] && c < ema[i]) { pending = { kind: 'all', why: 'r6-trail-20ema' }; continue; } }
    else if (lastOfWeek[i]) { const wc = []; for (let j = i; j >= 0 && wc.length < 10; j--) if (lastOfWeek[j] && s.c[j] > 0) wc.push(s.c[j]); if (wc.length === 10 && c < mean(wc)) { pending = { kind: 'all', why: 'r6-trail-10wk' }; continue; } }
    if (!thirdSold && gain >= 2) { pending = { kind: 'third', why: 'r5' }; continue; }
    if (!extSold && ema[i] === ema[i] && c >= 1.2 * ema[i]) { pending = { kind: 'third', why: 'r7' }; continue; }
    exitIdx = i;
  }
  if (left > 1e-9) { let last = -1; for (let i = Math.min(N - 1, e + MAXHOLD); i >= e; i--) if (s.c[i] > 0) { last = i; break; } if (last < 0) return null; sell(left, s.c[last]); if (reason === 'end') reason = last >= e + MAXHOLD ? 'max-hold' : 'data-end'; exitIdx = last; }
  const cost = (costPct * E) / R;
  return { R: pnl - cost, grossR: pnl, reason, held: (exitIdx ?? e) - e + 1 };
}

// ---- nightly scan
let prev = {};
const picks = [], perNight = [], recent = new Map();   // recent: group -> entry indices accepted
const lastEntry = new Map();
const dv20At = (sym, t) => { const s = fullHist.series.get(sym); let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) { a += s.c[i] * s.v[i]; n++; } return n ? a / n : 0; };
const spyAbove = (e) => { let m = 0, n = 0; for (let i = e - 199; i <= e; i++) if (i >= 0 && spy[i] === spy[i]) { m += spy[i]; n++; } return n === 200 ? spy[e] > m / n : null; };
for (const t of nights) {
  const hist = buildHistories(days.slice(0, t + 1), allSplits.filter((r) => r[1] <= dates[t]), allowed);
  const light = lightOf(t);
  const out = runScan({ hist, types, sic, light, prev, noTightGate: GATE_OFF });
  prev = out.state;
  const take = (set, list) => {
    for (const cand of list) {
      const s = fullHist.series.get(cand.sym); if (!s) continue;
      const e = t + 1, x = t + 1 + HOLD;
      if (!(s.c[e] > 0)) continue;
      let xc = s.c[x]; if (!(xc > 0)) { for (let k = x; k > e; k--) if (s.c[k] > 0) { xc = s.c[k]; break; } if (!(xc > 0)) continue; }
      const key = set + cand.sym; if (lastEntry.has(key) && e - lastEntry.get(key) < HOLD) continue;
      if (set === 'A' && CAP > 0) { const g = cand.group ?? cand.sym, arr = (recent.get(g) ?? []).filter((i) => e - i < CAPWIN); if (arr.length >= CAP) continue; arr.push(e); recent.set(g, arr); }
      lastEntry.set(key, e);
      const dv = dv20At(cand.sym, t), cost = tierCost(dv), ret = xc / s.c[e] - 1, sret = spy[x] / spy[e] - 1;
      const pk = { set, t, date: dates[t], sym: cand.sym, group: cand.group, ret, spy: sret, cost, ex: ret - cost - sret, dv, spyAbove: spyAbove(e), rs121: cand.diag.rs121 };
      if (STAGE2 && set === 'A' && cand.setup) pk.s2 = simulate(cand.sym, t, cand.setup, cost);
      picks.push(pk);
    }
  };
  take('A', out.ready);
  take('B', [...out.ready, ...out.watch].sort((a, b) => b.composite - a.composite).slice(0, SCAN.top));
  perNight.push([dates[t], light, out.ready.length, out.watch.length]);
}

// ---- stats
function bootstrap(ps, key, reps = 5000, block = 5) {
  if (!ps.length) return null;
  const by = new Map(); for (const p of ps) { const b = Math.floor((p.t - FIRST) / block); (by.get(b) ?? by.set(b, []).get(b)).push(p[key]); }
  const bl = [...by.values()], rnd = mulberry(SEED), means = [];
  for (let r = 0; r < reps; r++) { let s = 0, n = 0; for (let i = 0; i < bl.length; i++) { const b = bl[Math.floor(rnd() * bl.length)]; for (const x of b) { s += x; n++; } } means.push(n ? s / n : 0); }
  means.sort((a, b) => a - b); return { lo: means[Math.floor(0.05 * reps)], hi: means[Math.floor(0.95 * reps)] };
}
const sum = (ps, key = 'ex') => {
  const m = ps.length ? mean(ps.map((p) => p[key])) : null, ci = bootstrap(ps, key);
  return { n: ps.length, mean: m, ci, hit: ps.length ? mean(ps.map((p) => (p[key] > 0 ? 1 : 0))) : null, worst: ps.length ? Math.min(...ps.map((p) => p[key])) : null };
};
const mid = FIRST + Math.floor((LAST - FIRST) / 2);
const res = { run: { tag: TAG, gateOff: GATE_OFF, regime: REGIME, cap: CAP, nights: nights.length, first: dates[nights[0]], last: dates[nights[nights.length - 1]], hold: HOLD, seed: SEED, regimeFallbackNights: regimeFallbacks, breadthCheck, lightNights: Object.fromEntries(['green', 'yellow', 'red'].map((k) => [k, perNight.filter((p) => p[1] === k).length])) }, sets: {} };
for (const set of ['A', 'B']) {
  const ps = picks.filter((p) => p.set === set), r = { all: sum(ps), earlier: sum(ps.filter((p) => p.t <= mid)), later: sum(ps.filter((p) => p.t > mid)) };
  const g = new Map(); for (const p of ps) (g.get(p.group) ?? g.set(p.group, []).get(p.group)).push(p);
  const groups = [...g].map(([k, a]) => ({ group: k, n: a.length, share: a.length / (ps.length || 1), meanEx: mean(a.map((p) => p.ex)), sumEx: a.reduce((x, p) => x + p.ex, 0) })).sort((a, b) => b.sumEx - a.sumEx);
  r.byGroup = groups.slice(0, 12); r.maxGroupShare = groups.length ? Math.max(...groups.map((x) => x.share)) : 0;
  r.topGroup = groups[0]?.group ?? null; r.exTopGroup = groups.length ? sum(ps.filter((p) => p.group !== groups[0].group)) : sum([]);
  r.byMarket = { spyAbove200: sum(ps.filter((p) => p.spyAbove === true)), spyBelow200: sum(ps.filter((p) => p.spyAbove === false)) };
  const med = ps.map((p) => p.rs121).filter((x) => x !== null).sort((a, b) => a - b)[Math.floor(ps.length / 2)];
  r.by121 = { above: sum(ps.filter((p) => p.rs121 !== null && p.rs121 >= med)), below: sum(ps.filter((p) => p.rs121 !== null && p.rs121 < med)), median: med ?? null };
  r.picksPerNight = ps.length / nights.length;
  // matched random control with the same tiered cost rule
  const rnd = mulberry(SEED + 1), counts = new Map(); for (const p of ps) counts.set(p.t, (counts.get(p.t) ?? 0) + 1);
  const pool = new Map();
  for (const t of counts.keys()) {
    const arr = []; for (const [sym, s] of fullHist.series) {
      if (!(s.c[t] >= SCAN.minPrice) || !(s.c[t + 1] > 0) || !(s.c[t + 1 + HOLD] > 0)) continue;
      let n = 0, dv = 0, c = 0; for (let i = 0; i <= t; i++) if (s.c[i] === s.c[i]) n++;
      for (let i = t - 19; i <= t; i++) if (s.c[i] === s.c[i] && s.v[i] === s.v[i]) { dv += s.c[i] * s.v[i]; c++; }
      if (n >= SCAN.minSessions && c >= 15 && dv / c >= SCAN.minDollarVol) arr.push([sym, dv / c]);
    }
    pool.set(t, arr);
  }
  const ctl = [];
  for (let d = 0; d < 200; d++) { let s2 = 0, n = 0; for (const [t, k] of counts) { const arr = pool.get(t); if (!arr.length) continue; for (let i = 0; i < k; i++) { const [sym, dv] = arr[Math.floor(rnd() * arr.length)]; const s = fullHist.series.get(sym); s2 += s.c[t + 1 + HOLD] / s.c[t + 1] - 1 - tierCost(dv) - (spy[t + 1 + HOLD] / spy[t + 1] - 1); n++; } } ctl.push(n ? s2 / n : 0); }
  ctl.sort((a, b) => a - b); r.control = { mean: mean(ctl), p95: ctl[Math.floor(0.95 * ctl.length)] };
  res.sets[set] = r;
}
// stage 2
if (STAGE2) {
  const tr = picks.filter((p) => p.set === 'A' && p.s2).map((p) => ({ t: p.t, R: p.s2.R, held: p.s2.held, reason: p.s2.reason, group: p.group }));
  const reasons = {}; for (const x of tr) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  res.stage2 = { picksWithSetup: picks.filter((p) => p.set === 'A').length, trades: tr.length, meanR: tr.length ? mean(tr.map((x) => x.R)) : null, ci: bootstrap(tr, 'R'), winRate: tr.length ? mean(tr.map((x) => (x.R > 0 ? 1 : 0))) : null, avgHeld: tr.length ? mean(tr.map((x) => x.held)) : null, reasons, note: 'exit rules at daily-close resolution: stops fill at the stop, signals fill at the next close; rules 8 and 9 not modelled' };
}
// criteria (judged set A)
const A = res.sets.A;
res.criteria = {
  c1_enoughPicks: { value: A.all.n, pass: A.all.n >= 150 },
  c3_edge: { mean: A.all.mean, ci: A.all.ci, exTopGroup: A.exTopGroup, topGroup: A.topGroup, pass: !!(A.all.ci && A.all.ci.lo > 0 && A.exTopGroup.ci && A.exTopGroup.ci.lo > 0) },
  c4_halves: { earlier: A.earlier.mean, later: A.later.mean, pass: A.earlier.mean > 0 && A.later.mean > 0 },
  c5_control: { picks: A.all.mean, p95: A.control.p95, pass: A.all.mean > A.control.p95 },
  c6_concentration: { maxGroupShare: A.maxGroupShare, pass: A.maxGroupShare <= 0.25 },
  c7_stage2: res.stage2 ? { trades: res.stage2.trades, meanR: res.stage2.meanR, ci: res.stage2.ci, pass: res.stage2.trades >= 150 && res.stage2.ci && res.stage2.ci.lo > 0 } : null,
};
// criterion 2: leak test (10 seeded nights): full-data build cut at the night against the real-time build
if (LEAK) {
  const rnd = mulberry(SEED), chosen = [];
  while (chosen.length < Math.min(10, nights.length)) { const t = nights[Math.floor(rnd() * nights.length)]; if (!chosen.includes(t)) chosen.push(t); }
  chosen.sort((a, b) => a - b); const diffs = [];
  for (const t of chosen) {
    const fh = buildHistories(days, allSplits.filter((r) => r[1] <= dates[t]), allowed);
    const cut = { dates: fh.dates.slice(0, t + 1), series: new Map([...fh.series].map(([k, s]) => [k, { c: s.c.subarray(0, t + 1), h: s.h.subarray(0, t + 1), l: s.l.subarray(0, t + 1), v: s.v.subarray(0, t + 1) }])) };
    const a = runScan({ hist: cut, types, sic, light: lightOf(t), prev: {}, noTightGate: GATE_OFF });
    const b = runScan({ hist: buildHistories(days.slice(0, t + 1), allSplits.filter((r) => r[1] <= dates[t]), allowed), types, sic, light: lightOf(t), prev: {}, noTightGate: GATE_OFF });
    const nm = (o) => [...o.ready, ...o.watch].map((c) => c.sym).join();
    diffs.push({ date: dates[t], same: nm(a) === nm(b) });
  }
  res.criteria.c2_leak = { nights: diffs, pass: diffs.every((d) => d.same) };
}
mkdirSync('data/replay', { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...res, perNight }, null, 1) + '\n');
console.log(JSON.stringify({ run: res.run, criteria: res.criteria, stage2: res.stage2 ?? null, A: { all: A.all, earlier: A.earlier.mean, later: A.later.mean, topGroup: A.topGroup, maxShare: A.maxGroupShare }, B: res.sets.B.all }, null, 1));
