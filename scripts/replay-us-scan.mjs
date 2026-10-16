// C-51: historical replay of the frozen US scan (US-SCAN-1). Criteria: docs/replay/US-SCAN-REPLAY-PREREG.md (written and committed before any run).
// Usage: node scripts/replay-us-scan.mjs [--light=yellow] [--weights=60,25,15] [--limit=N] [--out=path] [--leak]
// Each night is scanned on data up to that night only (real-time build: splits known by then, gap breaks seen so far). Picks enter at the next close, exit 20 sessions later.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories, runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LIGHT = arg('light', 'yellow');
const [wr, wt, wp] = arg('weights', '60,25,15').split(',').map(Number);
SCAN.weights = { rs: wr, tightness: wt, pivot: wp };
const LIMIT = +arg('limit', 0);
const OUT = arg('out', `data/replay/us-scan-replay-${LIGHT}-${wr}-${wt}-${wp}.json`);
const LEAK = process.argv.includes('--leak');
const HOLD = 20, COST = 0.003, COST2 = 0.006, SEED = 20261016;

const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- load
const dir = 'data/us/grouped';
const files = readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.csv\.gz$/.test(f)).sort();
const tkFile = readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop();
const tk = JSON.parse(readFileSync('data/us/' + tkFile, 'utf8'));
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
const N = days.length;
const allSplits = JSON.parse(readFileSync('data/us/splits.json', 'utf8')).rows;
const sic = new Map();
if (existsSync('data/us/sic.json')) for (const [sym, code] of JSON.parse(readFileSync('data/us/sic.json', 'utf8')).rows) if (code) sic.set(sym, +code);
const FIRST = SCAN.quarter * 4;        // 252 sessions of history for the four-quarter score
const LAST = N - 1 - HOLD - 1;         // entry t+1 and exit t+21 must exist
let nights = []; for (let t = FIRST; t <= LAST; t++) nights.push(t);
if (LIMIT) nights = nights.slice(0, LIMIT);

// full-data history (all splits, gaps seen to the end): used for returns and for the leak test
const fullHist = buildHistories(days, allSplits, allowed);
const truncated = (t) => ({ dates: fullHist.dates.slice(0, t + 1), series: new Map([...fullHist.series].map(([k, s]) => [k, { c: s.c.subarray(0, t + 1), h: s.h.subarray(0, t + 1), l: s.l.subarray(0, t + 1), v: s.v.subarray(0, t + 1) }])) });

// ---- nightly real-time scan
let prev = {};
const picks = [], perNight = [], lists = [];
const lastEntry = new Map();
for (const t of nights) {
  const dsub = days.slice(0, t + 1), spl = allSplits.filter((r) => r[1] <= days[t].date);
  const hist = buildHistories(dsub, spl, allowed);
  const out = runScan({ hist, types, sic, light: LIGHT, prev });
  prev = out.state;
  const toPick = (set, c) => {
    for (const cand of c) {
      const s = fullHist.series.get(cand.sym); if (!s) continue;
      const e = t + 1, x = t + 1 + HOLD;
      if (!(s.c[e] > 0)) continue;
      let xc = s.c[x], missing = false; if (!(xc > 0)) { missing = true; for (let k = x; k > e; k--) if (s.c[k] > 0) { xc = s.c[k]; break; } if (!(xc > 0)) continue; }
      const key = set + cand.sym; if (lastEntry.has(key) && e - lastEntry.get(key) < HOLD) continue; lastEntry.set(key, e);
      const ret = xc / s.c[e] - 1, sret = spy[x] / spy[e] - 1;
      const spyAbove = (() => { let m = 0, n = 0; for (let i = e - 199; i <= e; i++) if (i >= 0 && spy[i] === spy[i]) { m += spy[i]; n++; } return n === 200 ? spy[e] > m / n : null; })();
      picks.push({ set, t, date: days[t].date, sym: cand.sym, group: cand.group, ret, spy: sret, ex30: ret - COST - sret, ex60: ret - COST2 - sret, missing, spyAbove, rsPct: cand.rsPct });
    }
  };
  toPick('A', out.ready);
  toPick('B', [...out.ready, ...out.watch].sort((a, b) => b.composite - a.composite).slice(0, SCAN.top));
  perNight.push([days[t].date, out.ready.length, out.watch.length, out.funnel.qualified]);
  lists.push([t, out.ready.map((c) => c.sym), [...out.ready, ...out.watch].map((c) => c.sym)]);
}

// ---- stats
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function bootstrap(ps, key, reps = 5000, block = 5) {
  if (!ps.length) return null;
  const by = new Map(); for (const p of ps) { const b = Math.floor((p.t - FIRST) / block); (by.get(b) ?? by.set(b, []).get(b)).push(p[key]); }
  const bl = [...by.values()], rnd = mulberry(SEED), means = [];
  for (let r = 0; r < reps; r++) { let s = 0, n = 0; for (let i = 0; i < bl.length; i++) { const b = bl[Math.floor(rnd() * bl.length)]; for (const x of b) { s += x; n++; } } means.push(n ? s / n : 0); }
  means.sort((a, b) => a - b); return { lo: means[Math.floor(0.05 * reps)], hi: means[Math.floor(0.95 * reps)] };
}
const summarize = (ps) => ({
  n: ps.length, mean30: mean(ps.map((p) => p.ex30)), mean60: mean(ps.map((p) => p.ex60)), ci30: bootstrap(ps, 'ex30'), ci60: bootstrap(ps, 'ex60'),
  hit: mean(ps.map((p) => (p.ex30 > 0 ? 1 : 0))), worst: ps.length ? Math.min(...ps.map((p) => p.ex30)) : null, missingExit: ps.filter((p) => p.missing).length,
});
const res = { run: { light: LIGHT, weights: SCAN.weights, nights: nights.length, first: days[nights[0]]?.date, last: days[nights[nights.length - 1]]?.date, cost: COST, hold: HOLD, seed: SEED }, sets: {} };
const mid = FIRST + Math.floor((LAST - FIRST) / 2);
for (const set of ['A', 'B']) {
  const ps = picks.filter((p) => p.set === set);
  const r = { all: summarize(ps), earlier: summarize(ps.filter((p) => p.t <= mid)), later: summarize(ps.filter((p) => p.t > mid)) };
  r.perNight = { nightsWithPicks: new Set(ps.map((p) => p.t)).size, picksPerNightMean: ps.length / nights.length };
  r.byMarket = { spyAbove200: summarize(ps.filter((p) => p.spyAbove === true)), spyBelow200: summarize(ps.filter((p) => p.spyAbove === false)) };
  const g = new Map(); for (const p of ps) (g.get(p.group) ?? g.set(p.group, []).get(p.group)).push(p);
  r.byGroup = [...g].map(([k, a]) => ({ group: k, n: a.length, mean30: mean(a.map((p) => p.ex30)) })).sort((a, b) => b.n - a.n).slice(0, 15);
  // matched random control (criterion 5)
  const rnd = mulberry(SEED + 1), counts = new Map(); for (const p of ps) counts.set(p.t, (counts.get(p.t) ?? 0) + 1);
  const pool = new Map();
  for (const t of counts.keys()) {
    const arr = []; for (const [sym, s] of fullHist.series) {
      if (!(s.c[t] >= SCAN.minPrice) || !(s.c[t + 1] > 0) || !(s.c[t + 1 + HOLD] > 0)) continue;
      let n = 0, dv = 0, c = 0; for (let i = 0; i <= t; i++) if (s.c[i] === s.c[i]) n++;
      for (let i = t - 19; i <= t; i++) if (s.c[i] === s.c[i] && s.v[i] === s.v[i]) { dv += s.c[i] * s.v[i]; c++; }
      if (n >= SCAN.minSessions && c >= 15 && dv / c >= SCAN.minDollarVol) arr.push(sym);
    }
    pool.set(t, arr);
  }
  const ctl = [];
  for (let d = 0; d < 200; d++) { let sum = 0, n = 0; for (const [t, k] of counts) { const arr = pool.get(t); if (!arr.length) continue; for (let i = 0; i < k; i++) { const s = fullHist.series.get(arr[Math.floor(rnd() * arr.length)]); sum += s.c[t + 1 + HOLD] / s.c[t + 1] - 1 - COST - (spy[t + 1 + HOLD] / spy[t + 1] - 1); n++; } } ctl.push(n ? sum / n : 0); }
  ctl.sort((a, b) => a - b); r.control = { mean: mean(ctl), p95: ctl[Math.floor(0.95 * ctl.length)], draws: ctl.length };
  res.sets[set] = r;
}
// ---- criteria
const A = res.sets.A, B = res.sets.B;
const judged = A.all.n >= 150 ? 'A' : 'B'; const J = res.sets[judged];
res.criteria = {
  judgedSet: judged,
  c1_enoughPicks: { value: A.all.n, pass: A.all.n >= 150 },
  c3_edge: { mean30: J.all.mean30, ci30: J.all.ci30, pass: J.all.ci30 ? J.all.ci30.lo > 0 && J.all.mean30 > 0 : false },
  c4_halves: { earlier: J.earlier.mean30, later: J.later.mean30, pass: J.earlier.mean30 > 0 && J.later.mean30 > 0 },
  c5_control: { picks: J.all.mean30, controlP95: J.control.p95, pass: J.all.mean30 > J.control.p95 },
};

// ---- criterion 2: leak test (10 seeded nights): truncated full-data build vs real-time build
if (LEAK) {
  const rnd = mulberry(SEED), chosen = [];
  while (chosen.length < Math.min(10, nights.length)) { const t = nights[Math.floor(rnd() * nights.length)]; if (!chosen.includes(t)) chosen.push(t); }
  chosen.sort((a, b) => a - b);
  const diffs = [];
  for (const t of chosen) {
    const a = runScan({ hist: truncated(t), types, sic, light: LIGHT, prev: {} });
    const b = runScan({ hist: buildHistories(days.slice(0, t + 1), allSplits.filter((r) => r[1] <= days[t].date), allowed), types, sic, light: LIGHT, prev: {} });
    const names = (o) => [...o.ready, ...o.watch].map((c) => c.sym);
    const na = names(a), nb = names(b);
    const laterSplit = new Set(allSplits.filter((r) => r[1] > days[t].date).map((r) => r[0]));
    const diff = [...new Set([...na.filter((x) => !nb.includes(x)), ...nb.filter((x) => !na.includes(x))])].filter((x) => !laterSplit.has(x));
    const orderDiff = na.filter((x) => nb.includes(x)).join() !== nb.filter((x) => na.includes(x)).join();
    // diagnostic (not the pre-registered test): full-data build using only splits known by the night, truncated to the night
    const past = allSplits.filter((r) => r[1] <= days[t].date), fh = buildHistories(days, past, allowed);
    const fp = { dates: fh.dates.slice(0, t + 1), series: new Map([...fh.series].map(([k, s]) => [k, { c: s.c.subarray(0, t + 1), h: s.h.subarray(0, t + 1), l: s.l.subarray(0, t + 1), v: s.v.subarray(0, t + 1) }])) };
    const nc = names(runScan({ hist: fp, types, sic, light: LIGHT, prev: {} }));
    diffs.push({ date: days[t].date, onlyOneSide: diff, orderDiffers: orderDiff && !na.some((x) => laterSplit.has(x)) && !nb.some((x) => laterSplit.has(x)), n: [na.length, nb.length], pastSplitsOnlyMatchesRealtime: nc.join() === nb.join() });
  }
  res.criteria.c2_leak = { nights: diffs, pass: diffs.every((d) => d.onlyOneSide.length === 0 && !d.orderDiffers), diagnostic_pastSplitsOnlyMatchesRealtimeAllNights: diffs.every((d) => d.pastSplitsOnlyMatchesRealtime) };
}
res.perNight = perNight;
mkdirSync('data/replay', { recursive: true });
writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify({ run: res.run, criteria: res.criteria, A: { all: A.all, earlier: A.earlier.mean30, later: A.later.mean30 }, B: { all: B.all.n, mean30: B.all.mean30 } }, null, 1));
