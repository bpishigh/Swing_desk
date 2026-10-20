// C-70 India holding period. Registered in the change log and the run manifest (C-70-r1) before running.
// Same entries as C-65 (monthly momentum list, regime on, bought at the next close, tiered cost). Variants: fixed holds of 20, 60, 120 sessions and the live exits (desk-sim, ATR stop, 60-session cap).
// Holdout rows are hidden until the manifest records a reveal. Usage: node --max-old-space-size=8000 scripts/replay-ind-holdperiod.mjs --run=C-70-r1 [--costx=2] [--limit=N]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { tierCost, eligible, topShare } from '../src/backtest/ind-base.ts';
import { deskSim, dateCalendar } from '../src/backtest/desk-sim.ts';
import { loadManifest, gate } from '../src/backtest/manifest.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const RUN = arg('run'), COSTX = +arg('costx', 1), LIMIT = +arg('limit', 0), HOLDS = [20, 60, 120], MAXHOLD = 60;
const entry = loadManifest().runs.find((r) => r.id === RUN); if (!entry) { console.error('register the run first (scripts/backtest-manifest.mjs) and pass --run=<id>'); process.exit(1); }
const L = loadIndia(), { dates, T, days, res, allowed, FH, RD, mkt, mk, sma } = L, CAL = dateCalendar(dates);
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const idxRaw = {}; for (let y = 2020; y <= 2025; y++) Object.assign(idxRaw, Object.fromEntries(Object.entries(R(`data/india/idx-hist/idx-${y}.json`)['Nifty 500'] || {}).map(([d, v]) => [d, v[3]])));
const idx = new Float64Array(T).fill(NaN); { let last = NaN; for (let i = 0; i < T; i++) { if (dates[i] in idxRaw) last = idxRaw[dates[i]]; idx[i] = dates[i] <= '2025-10-16' ? last : NaN; } }
const regimeOn = (t) => (dates[t] <= '2025-10-16' ? idx[t] >= sma(idx, t, 200) : mk[t] >= sma(mk, t, 200));
function live(sym, e) {
  const s = FH.series.get(sym); if (!s || !(s.c[e] > 0)) return null;
  let a = 0, n = 0; for (let i = e - 13; i <= e; i++) { const pc = s.c[i - 1]; if (s.h[i] > 0 && s.l[i] > 0 && pc > 0) { a += Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - pc), Math.abs(s.l[i] - pc)); n++; } }
  if (n < 10) return null; const atr = a / n, E = s.c[e], Rk = 1.5 * atr; if (!(Rk > 0) || Rk >= E) return null;
  const rd = (RD.dates[sym] || []).filter((d) => d >= dates[e]).sort()[0];
  const r = deskSim({ dates, c: s.c, h: s.h, l: s.l, e, trigger: E, stop: E - Rk, setup: '2', resultsDate: rd, cal: CAL, maxHold: MAXHOLD, entryAtClose: true }); if (!r) return null;
  return r.R * (Rk / E);
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const sig = []; for (let i = 1; i < T; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= '2021-01-01' && i + 1 + 120 < T) sig.push(i);
const rows = [];
for (const t of (LIMIT ? sig.slice(0, LIMIT) : sig)) {
  if (!regimeOn(t)) continue; const e = t + 1, top = topShare(eligible(asOfHistories(days, t, res, allowed), t));
  for (const p of top) {
    const s = FH.series.get(p.sym); if (!s || !(s.c[e] > 0)) continue; const cost = tierCost(p.value) * COSTX, o = { s: p.sym, d: dates[t], ym: dates[t].slice(0, 7) }; let ok = true;
    for (const n of HOLDS) { const c1 = s.c[e + n]; if (!(c1 > 0)) { ok = false; break; } const net = c1 / s.c[e] - 1 - cost, m = mkt(e, e + n); if (!(m === m)) { ok = false; break; } o['n' + n] = net; o['x' + n] = (1 + net) ** (20 / n) - (1 + m) ** (20 / n); }
    const lv = ok ? live(p.sym, e) : null; if (!ok || lv === null) continue; o.live = lv - cost; rows.push(o);
  }
}
const g = gate(entry, rows, (r) => r.d), pct = (v) => (v * 100).toFixed(2) + '%';
const tOf = (a, f) => { const m = {}; for (const r of a) (m[r.ym] ||= []).push(f(r)); const v = Object.values(m).map(mean); return v.length > 2 ? mean(v) / (sd(v) / Math.sqrt(v.length)) : NaN; };
const report = (name, a) => {
  const o = { n: a.length, hold: {}, per20ex: {} }; for (const n of HOLDS) { o.hold[n] = mean(a.map((r) => r['n' + n])); o.per20ex[n] = mean(a.map((r) => r['x' + n])); } o.live = mean(a.map((r) => r.live));
  o.h1 = { 60: { diff: o.per20ex[60] - o.per20ex[20], t: tOf(a, (r) => r.x60 - r.x20) }, 120: { diff: o.per20ex[120] - o.per20ex[20], t: tOf(a, (r) => r.x120 - r.x20) } }; o.h2 = { diff: o.live - o.hold[60], t: tOf(a, (r) => r.live - r.n60) };
  console.log(`${name} n=${a.length} | net per trade: hold20 ${pct(o.hold[20])} hold60 ${pct(o.hold[60])} hold120 ${pct(o.hold[120])} live ${pct(o.live)} | per-20-session excess over market: 20 ${pct(o.per20ex[20])} 60 ${pct(o.per20ex[60])} 120 ${pct(o.per20ex[120])}`);
  console.log(`   H1 60-20 ${pct(o.h1[60].diff)} t ${o.h1[60].t.toFixed(2)} | 120-20 ${pct(o.h1[120].diff)} t ${o.h1[120].t.toFixed(2)} | H2 live-hold60 ${pct(o.h2.diff)} t ${o.h2.t.toFixed(2)}`); return o;
};
console.log(`${RUN} costx ${COSTX} | rows ${rows.length} | fit ${g.fit.length} | holdout ${g.holdout ? g.holdout.length : 'hidden (' + g.hidden + ' rows)'}`);
const out = { run: RUN, costx: COSTX, fit: report('FIT', g.fit) }; if (g.holdout) out.holdout = report('HOLDOUT', g.holdout);
const f = out.fit, h1 = [60, 120].some((n) => f.h1[n].diff >= 0.005 && f.h1[n].t > 2), h2 = f.h2.diff >= 0.005 && f.h2.t > 2;
console.log(`FIT RULES: H1 ${h1 ? 'PASS' : 'FAIL'} | H2 ${h2 ? 'PASS' : 'FAIL'}`);
mkdirSync('data/replay', { recursive: true }); writeFileSync(`data/replay/ind-holdperiod${COSTX > 1 ? '-cost' + COSTX + 'x' : ''}.json`, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), out }, null, 1) + '\n');
