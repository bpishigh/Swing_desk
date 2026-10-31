// C-128: Clenow-style fast momentum book (weekly rank, 90-session exponential-regression slope x R squared). Registered in docs/backtests/manifest.json. One run per market, no tuning.
// Usage: node --max-old-space-size=7000 scripts/backtest-clenow.mjs india|us     then: node scripts/backtest-clenow.mjs combine
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMean, mean, BASE, eligible as indEligible, tierCost } from '../src/backtest/ind-base.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { spliceIndex } from '../src/backtest/index-splice.ts';
import { loadUs, usCost } from '../src/backtest/us-loader.ts';
const MKT = process.argv[2], R = (p) => JSON.parse(readFileSync(p, 'utf8')), f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x * 100).toFixed(2) + '%';
const LB = 90, MA = 100, GAP = 0.15, TOP = 0.2, RISK = 0.001, ATRN = 20, IDXMA = 200;
if (MKT === 'combine') {
  const a = R('data/replay/c128-india.json'), b = R('data/replay/c128-us.json'), pass = a.windows[0].pass && b.windows[0].pass;
  const md = `# C-128 combined\n\nIndia 2011-2019: ${a.windows[0].pass ? 'PASS' : 'FAIL'}\nUS 2018-2025: ${b.windows[0].pass ? 'PASS' : 'FAIL'}\nBoth judged markets: ${pass ? 'PASS' : 'FAIL'}\n`;
  writeFileSync('docs/replay/C128-REPORT.md', md + '\n' + readFileSync('docs/replay/C128-india-REPORT.md', 'utf8') + '\n' + readFileSync('docs/replay/C128-us-REPORT.md', 'utf8')); console.log(md); process.exit(0);
}
if (!['india', 'us'].includes(MKT)) { console.error('usage: india|us|combine'); process.exit(2); }
let dates, N, series, benchIdx, buildEl, costOf, from, to, wins;
if (MKT === 'india') {
  const D = loadIndia('data/india', { pre2020: true, allSymbols: true }); ({ dates } = D); N = D.T; series = D.FH.series; from = '2011-01-01'; to = '2025-10-31';
  const nifty = {}, bse = {}; for (let y = 2010; y <= 2025; y++) { let o; try { o = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3]; for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3]; }
  benchIdx = spliceIndex(dates, nifty, bse).values; for (let i = 1; i < benchIdx.length; i++) if (!(benchIdx[i] > 0)) benchIdx[i] = benchIdx[i - 1]; /* index files miss some 2023 and 2025 sessions: carry forward (reported window only; 2011-2019 has none) */ costOf = (p) => tierCost(p.value);
  buildEl = (t) => { const hist = asOfHistories(D.days, t, D.res, D.allowed); return indEligible(hist, t, BASE.skip).map((p) => ({ sym: p.sym, value: p.value })); };
  wins = [['India 2011-2019', '2011-01-01', '2019-12-31', true], ['India 2021-2025 (reported)', '2021-01-01', '2025-10-31', false]];
} else {
  const D = loadUs(); ({ dates, N } = D); series = D.hist.series; from = '2018-01-01'; to = '2025-10-31'; benchIdx = D.spy; costOf = (p) => usCost(p.dv);
  const F = { minPrice: 10, minDV: 10e6, universe: 500, minSessions: 260 };
  buildEl = (t) => { const out = [];
    for (const [sym, s] of series) { const c = s.c[t]; if (!(c >= F.minPrice)) continue; let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] === s.c[i]) n++; if (n < F.minSessions) continue;
      const vals = []; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) vals.push(s.c[i] * s.v[i]); if (vals.length < 15) continue; const dv = vals.reduce((a, b) => a + b, 0) / vals.length; if (dv < F.minDV) continue;
      const b = [...vals].sort((x, y) => x - y), m = b.length >> 1, value = b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; out.push({ sym, value, dv }); }
    out.sort((x, y) => y.value - x.value || (x.sym < y.sym ? -1 : 1)); return out.slice(0, F.universe); };
  wins = [['US 2018-2025 (survivor-biased upward)', '2018-01-01', '2025-09-30', true]];
}
// monthly eligible lists (as in C-121); cached so a rerun does not repeat the slow India build
const M = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) M.push(i);
const cache = `/tmp/c128-el-${MKT}.json`; let EL;
if (existsSync(cache)) EL = R(cache); else { const t0 = Date.now(); EL = M.map((t) => buildEl(t)); writeFileSync(cache, JSON.stringify(EL)); console.error(`${MKT}: ${M.length} lists ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
const elAt = (t) => { let k = -1; for (let j = 0; j < M.length; j++) { if (M[j] <= t) k = j; else break; } return k; };
// weekly signal sessions: first session on or after Wednesday in each ISO week
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay(), wk = (d) => { const t = new Date(d + 'T00:00:00Z'), w = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - w); const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-' + Math.ceil(((t - j) / 864e5 + 1) / 7); };
const SIG = [], seen = new Set(); for (let i = 0; i < N - 1; i++) { if (dates[i] < from || dates[i] > to) continue; if (dow(dates[i]) >= 3 || dow(dates[i]) === 0) { const k = wk(dates[i]); if (!seen.has(k)) { seen.add(k); SIG.push(i); } } }
function metrics(s, t) {   // slope x R2, 100-day test, gap test, ATR as share of price; null when the window is not complete
  if (t < MA + 1) return null; const c = s.c; if (!(c[t] > 0)) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, gap = false; for (let k = 0; k < LB; k++) { const v = c[t - LB + 1 + k]; if (!(v > 0)) return null; const y = Math.log(v), x = k; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; if (k > 0 && Math.abs(v / c[t - LB + k] - 1) > GAP) gap = true; }
  const n = LB, den = n * sxx - sx * sx, b = (n * sxy - sx * sy) / den, r2 = (n * sxy - sx * sy) ** 2 / (den * (n * syy - sy * sy) || 1);
  let ma = 0; for (let k = 0; k < MA; k++) { const v = c[t - k]; if (!(v > 0)) return null; ma += v; } ma /= MA;
  let tr = 0; for (let k = 0; k < ATRN; k++) { const i = t - k, h = s.h[i], l = s.l[i], pc = c[i - 1]; if (!(h > 0 && l > 0 && pc > 0)) return null; tr += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); }
  return { score: (Math.exp(b * 250) - 1) * r2, ok: c[t] > ma && !gap, atr: tr / ATRN / c[t] };
}
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
function run(d0, d1) {
  const sigs = SIG.filter((t) => dates[t + 1] >= d0 && dates[t + 1] <= d1 && elAt(t) >= 0); let cash = 1; const held = new Map(); const rows = []; let prev = null;
  for (const t of sigs) {
    const e = t + 1, el = EL[elAt(t)], elMap = new Map(el.map((p) => [p.sym, p])), met = new Map();
    for (const p of el) { const s = series.get(p.sym); if (!s) continue; const m = metrics(s, t); if (m) met.set(p.sym, m); }
    const ranked = [...met.entries()].sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1)).map((x) => x[0]), topN = Math.max(1, Math.ceil(ranked.length * TOP)), topSet = new Set(ranked.slice(0, topN));
    let eq = cash; for (const [sym, sh] of held) { const p = px(sym, e); eq += sh * (p > 0 ? p : 0); }
    // list benchmark: equal weight, previous week's list
    let bench = NaN; if (prev) { const v = []; for (const p of prev.el) { const a = px(p.sym, prev.e), b = px(p.sym, e); if (a > 0 && b > 0) v.push(b / a - 1); } bench = v.length ? mean(v) : NaN; }
    for (const [sym, sh] of [...held]) { const m = met.get(sym); if (!topSet.has(sym) || !m || !m.ok) { const p = px(sym, e), c = elMap.get(sym) ? costOf(elMap.get(sym)) : costOf({ value: 0, dv: 0 }); cash += sh * p * (1 - c / 2); held.delete(sym); } }
    const sma = (() => { let a = 0; for (let k = 0; k < IDXMA; k++) a += benchIdx[t - k]; return a / IDXMA; })(), idxOk = benchIdx[t] > sma; let buys = 0;
    if (idxOk) for (const sym of ranked.slice(0, topN)) { if (held.has(sym)) continue; const m = met.get(sym); if (!m.ok) continue; const price = px(sym, e); if (!(price > 0) || !(m.atr > 0)) continue; const val = eq * RISK / m.atr, c = costOf(elMap.get(sym)); if (val * (1 + c / 2) > cash) break; cash -= val * (1 + c / 2); held.set(sym, val / price); buys++; }
    let eq2 = cash; for (const [sym, sh] of held) { const p = px(sym, e); eq2 += sh * (p > 0 ? p : 0); }
    rows.push({ date: dates[e], e, eq: eq2, positions: held.size, idxOk, idx: benchIdx[e], bench, buys }); prev = { el, e };
  }
  return rows;
}
let seed = 20261031; const out = { run: new Date().toISOString().slice(0, 10), market: MKT, windows: [] }; let md = `# C-128 Clenow-style fast momentum, ${MKT}\n\nWeekly rank (Wednesday), 90-session slope x R squared, 100-session and gap filters, index above 200 sessions for new buys, ATR sizing 0.1% of equity, no leverage. Costs in. Index price only.\n\n`;
for (const [label, d0, d1, judged] of wins) {
  const rows = run(d0, d1); if (rows.length < 20) { console.error('too few weeks', label); continue; }
  const ex = [], pr = [], ir = [], br = [], yrS = {}, yrI = {}; for (let k = 1; k < rows.length; k++) { const r = rows[k].eq / rows[k - 1].eq - 1, i = rows[k].idx / rows[k - 1].idx - 1; pr.push(r); ir.push(i); ex.push(r - i); br.push(rows[k].bench); const y = rows[k].date.slice(0, 4); yrS[y] = (yrS[y] ?? 1) * (1 + r); yrI[y] = (yrI[y] ?? 1) * (1 + i); }
  const comp = (a) => a.reduce((x, y) => x * (1 + (y === y ? y : 0)), 1) - 1, cs = rows.at(-1).eq / rows[0].eq - 1, ci = rows.at(-1).idx / rows[0].idx - 1, cb = comp(br), [lo, hi] = bootMean(ex, 13, 5000, seed);
  let peak = 1, mdd = 0; for (const r of rows) { peak = Math.max(peak, r.eq); mdd = Math.min(mdd, r.eq / peak - 1); }
  const yrs = Object.keys(yrS), pos = yrs.filter((y) => yrS[y] > yrI[y]).length, criteria = { beatsIndex: cs > ci, beatsList: cs > cb, meanExcessAboveZero: mean(ex) > 0, ciLowAboveZero: lo > 0, twoThirdsYears: pos >= Math.ceil((2 / 3) * yrs.length) }, pass = Object.values(criteria).every(Boolean);
  const w = { label, judged, pass, weeks: ex.length, from: rows[0].date, to: rows.at(-1).date, strategy: cs, index: ci, list: cb, maxDrawdown: mdd, meanWeeklyExcess: mean(ex), ci90: [lo, hi], yearsBeatIndex: pos, years: yrs.length, avgPositions: mean(rows.map((r) => r.positions)), weeksIndexFilterOff: rows.filter((r) => !r.idxOk).length, byYear: Object.fromEntries(yrs.map((y) => [y, { strategy: yrS[y] - 1, index: yrI[y] - 1 }])), criteria };
  out.windows.push(w);
  md += `## ${label}: ${pass ? 'PASS' : 'FAIL'}${judged ? '' : ' (not judged)'}\n- ${w.weeks} weeks ${w.from} to ${w.to}; strategy ${f(cs)}, index ${f(ci)}, equal-weight list ${f(cb)}; max fall ${f(mdd)}\n- Mean weekly excess over index ${g(w.meanWeeklyExcess)}, 90% interval ${g(lo)} to ${g(hi)}; years beating index ${pos} of ${yrs.length}\n- Average positions ${w.avgPositions.toFixed(1)}; weeks index filter off ${w.weeksIndexFilterOff}\n- Conditions ${JSON.stringify(criteria)}\n- By year (strategy / index): ${yrs.map((y) => `${y} ${f(yrS[y] - 1)}/${f(yrI[y] - 1)}`).join(', ')}\n\n`;
}
writeFileSync(`data/replay/c128-${MKT}.json`, JSON.stringify(out, null, 1) + '\n'); writeFileSync(`docs/replay/C128-${MKT}-REPORT.md`, md); console.log(md);
