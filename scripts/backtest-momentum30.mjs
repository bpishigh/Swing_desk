// C-129: Nifty200 Momentum 30-style sleeve (methodology replication with stand-ins). Registered in docs/backtests/manifest.json. One run, no tuning.
// Usage: node --max-old-space-size=7000 scripts/backtest-momentum30.mjs      (needs /tmp/c128-el-india.json, or rebuilds it, ~20 min)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMean, mean, BASE, eligible as indEligible, tierCost } from '../src/backtest/ind-base.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { spliceIndex } from '../src/backtest/index-splice.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x * 100).toFixed(2) + '%';
const UNI = 200, HOLD = 30, KEEP = 45, W6 = 126, W12 = 252, CAPW = 0.05, CAPX = 5;
const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), { dates } = D, N = D.T, series = D.FH.series, from = '2011-01-01', to = '2025-10-31';
const idxOf = (name) => { const o = {}; for (let y = 2010; y <= 2025; y++) { let j; try { j = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(j[name] ?? {})) o[d] = v[3]; } return o; };
const bse = idxOf('BSE 500'), carry = (a) => { for (let i = 1; i < a.length; i++) if (!(a[i] > 0)) a[i] = a[i - 1]; return a; };
const n200 = carry(spliceIndex(dates, idxOf('Nifty 200'), bse).values), n500 = carry(spliceIndex(dates, idxOf('Nifty 500'), bse).values);
const M = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) M.push(i);
const cache = '/tmp/c128-el-india.json'; let EL;
if (existsSync(cache)) EL = R(cache); else { EL = M.map((t) => indEligible(asOfHistories(D.days, t, D.res, D.allowed), t, BASE.skip).map((p) => ({ sym: p.sym, value: p.value }))); writeFileSync(cache, JSON.stringify(EL)); }
if (EL.length !== M.length) throw new Error(`list count ${EL.length} != signals ${M.length}`);
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
function volAdj(s, t, w) {   // return over w sessions divided by the daily-return standard deviation over the same window; null when incomplete
  if (t - w < 0) return null; const c = s.c; if (!(c[t] > 0) || !(c[t - w] > 0)) return null; const r = []; for (let i = t - w + 1; i <= t; i++) { if (!(c[i] > 0) || !(c[i - 1] > 0)) continue; r.push(c[i] / c[i - 1] - 1); }
  if (r.length < 0.9 * w) return null; const m = mean(r), sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)); return sd > 0 ? (c[t] / c[t - w] - 1) / sd : null;
}
const z = (a) => { const m = mean(a), sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); return a.map((v) => (v - m) / sd); };
function capped(raw, cap) {   // pro-rata weights with per-name caps, redistributing the excess
  let w = raw.map((x) => x / raw.reduce((a, b) => a + b, 0)); const fixed = new Array(w.length).fill(false);
  for (let it = 0; it < 40; it++) { let over = false, free = 0, used = 0; w.forEach((x, i) => { if (!fixed[i] && x > cap[i] + 1e-12) { w[i] = cap[i]; fixed[i] = true; over = true; } }); if (!over) break;
    w.forEach((x, i) => { if (fixed[i]) used += x; else free += raw[i]; }); w = w.map((x, i) => (fixed[i] ? x : (raw[i] / free) * (1 - used))); }
  return w;
}
function select(k, prev) {   // returns [{sym, value, mult, rank}] for the chosen 30 and the universe value total
  const t = M[k], uni = EL[k].slice(0, UNI), rows = [];
  for (const p of uni) { const s = series.get(p.sym); if (!s) continue; const a6 = volAdj(s, t, W6), a12 = volAdj(s, t, W12); if (a6 === null || a12 === null) continue; rows.push({ ...p, a6, a12 }); }
  const z6 = z(rows.map((r) => r.a6)), z12 = z(rows.map((r) => r.a12)); rows.forEach((r, i) => { r.s = (z6[i] + z12[i]) / 2; r.mult = r.s >= 0 ? 1 + r.s : 1 / (1 - r.s); });
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1)); rows.forEach((r, i) => { r.rank = i + 1; });
  const keep = rows.filter((r) => prev.has(r.sym) && r.rank <= KEEP), chosen = new Set(keep.map((r) => r.sym)); for (const r of rows) { if (chosen.size >= HOLD) break; if (!chosen.has(r.sym)) chosen.add(r.sym); }
  return { picks: rows.filter((r) => chosen.has(r.sym)), total: uni.reduce((a, b) => a + b.value, 0), universe: rows.length };
}
const k0 = EL.findIndex((l) => l.length >= UNI);   // the first lists are empty: eligibility needs 260 sessions of history and the data starts in 2010
const signals = M.map((t, k) => k).filter((k) => k >= k0 && (k === k0 || ['06', '12'].includes(dates[M[k]].slice(5, 7))));
function run(weighting) {   // weighting: 'tilt' (score x traded value, capped) or 'equal'
  let cash = 1, held = new Map(), prev = new Set(), lastValue = new Map(); const eq = new Array(N).fill(NaN); let first = null, turn = [], names = [];
  const value = (i) => { let v = cash; for (const [sym, sh] of held) { const p = px(sym, i); v += sh * (p > 0 ? p : 0); } return v; };
  const sigAt = new Map(signals.map((k) => [M[k] + 1, k]));
  for (let i = 0; i < N; i++) {
    if (dates[i] > '2025-12-31') break;
    if (sigAt.has(i)) { const k = sigAt.get(i), sel = select(k, prev), V = value(i); first ??= i; names.push(sel.picks.length);
      for (const p of EL[k]) lastValue.set(p.sym, p.value);
      let w; if (weighting === 'equal') w = sel.picks.map(() => 1 / sel.picks.length); else { const raw = sel.picks.map((r) => r.value * r.mult); w = capped(raw, sel.picks.map((r) => Math.min(CAPW, CAPX * r.value / sel.total))); if (w.reduce((a, b) => a + b, 0) < 1 - 1e-9) w = capped(raw, raw.map(() => CAPW)); /* the 5x rule cannot allocate 100% when the picks are small by traded value: fall back to the 5% cap alone (first run left part of the portfolio unallocated and showed -100%) */ }
      const target = new Map(sel.picks.map((r, j) => [r.sym, w[j] * V])), all = new Set([...held.keys(), ...target.keys()]); let traded = 0, cost = 0;
      for (const sym of all) { const p = px(sym, i); if (!(p > 0)) continue; const cur = (held.get(sym) ?? 0) * p, tgt = target.get(sym) ?? 0, d = Math.abs(tgt - cur); traded += d; cost += d * tierCost(lastValue.get(sym) ?? 0) / 2; }
      turn.push(traded / (2 * V)); const V2 = V - cost; held = new Map(); cash = 0; for (const [sym, amt] of target) { const p = px(sym, i); if (p > 0) held.set(sym, (amt / V) * V2 / p); else cash += (amt / V) * V2; }
      prev = new Set(held.keys()); }
    if (first !== null && i >= first) eq[i] = value(i);
  }
  return { eq, first, turnover: mean(turn), holdings: mean(names) };
}
const monthEnds = []; for (let i = 0; i < N - 1; i++) if (dates[i].slice(0, 7) !== dates[i + 1].slice(0, 7)) monthEnds.push(i);
function stats(eqArr, idxArr, d0, d1) {
  const me = monthEnds.filter((i) => dates[i] >= d0 && dates[i] <= d1 && eqArr[i] > 0), ret = [], ir = [], yr = {}, yi = {};
  for (let j = 1; j < me.length; j++) { const a = me[j - 1], b = me[j], r = eqArr[b] / eqArr[a] - 1, q = idxArr[b] / idxArr[a] - 1; ret.push(r); ir.push(q); const y = dates[b].slice(0, 4); yr[y] = (yr[y] ?? 1) * (1 + r); yi[y] = (yi[y] ?? 1) * (1 + q); }
  const ex = ret.map((r, j) => r - ir[j]), [lo, hi] = bootMean(ex, 6, 5000, 20261031), sd = Math.sqrt(ex.reduce((a, b) => a + (b - mean(ex)) ** 2, 0) / (ex.length - 1)), yrs = Object.keys(yr), beat = yrs.filter((y) => yr[y] > yi[y]).length;
  let pk = 1, mdd = 0, v = 1; for (const r of ret) { v *= 1 + r; pk = Math.max(pk, v); mdd = Math.min(mdd, v / pk - 1); }
  return { months: ret.length, from: dates[me[0]], to: dates[me.at(-1)], sleeve: ret.reduce((a, r) => a * (1 + r), 1) - 1, index: ir.reduce((a, r) => a * (1 + r), 1) - 1, meanExcess: mean(ex), ci90: [lo, hi], minDetectable: 1.645 * sd / Math.sqrt(ex.length), yearsBeat: beat, years: yrs.length, maxFall: mdd, byYear: Object.fromEntries(yrs.map((y) => [y, { sleeve: yr[y] - 1, index: yi[y] - 1 }])), rets: ret };
}
const tilt = run('tilt'), equal = run('equal');
const out = { run: new Date().toISOString().slice(0, 10), assumptions: 'see change log C-129', turnoverPerRebalance: tilt.turnover, avgHoldings: tilt.holdings, windows: [] };
let md = `# C-129 Nifty200 Momentum 30-style sleeve (methodology replication with stand-ins)\n\nTop 200 by traded value, top 30 by score, semi-annual (June, December), no cash rule or stops, tiered costs. Price only. Stand-ins and assumptions are listed in the change log row.\n\nAverage one-way turnover per rebalance ${f(tilt.turnover)}; average holdings ${tilt.holdings.toFixed(1)}.\n\n`;
for (const [label, d0, d1, judged] of [['India 2011-2019', '2011-01-01', '2019-12-31', true], ['India 2021-2025 (reported)', '2021-01-01', '2025-10-31', false]]) {
  const a = stats(tilt.eq, n200, d0, d1), b = stats(tilt.eq, n500, d0, d1), e = stats(equal.eq, n200, d0, d1), c = { beatsIndex: a.sleeve > a.index, meanExcessAboveZero: a.meanExcess > 0, ciLowAboveZero: a.ci90[0] > 0, twoThirdsYears: a.yearsBeat >= Math.ceil((2 / 3) * a.years) }, pass = Object.values(c).every(Boolean);
  out.windows.push({ label, judged, pass, criteria: c, vsNifty200: { ...a, rets: undefined }, vsNifty500: { sleeve: b.sleeve, index: b.index, meanExcess: b.meanExcess, ci90: b.ci90 }, equalWeightDiagnostic: { sleeve: e.sleeve, meanExcessVsNifty200: e.meanExcess, ci90: e.ci90 } });
  md += `## ${label}: ${pass ? 'PASS' : 'FAIL'}${judged ? '' : ' (not judged)'}\n- ${a.months} months ${a.from} to ${a.to}. Sleeve ${f(a.sleeve)}; Nifty 200 ${f(a.index)}; Nifty 500 ${f(b.index)}. Max fall ${f(a.maxFall)}\n- Mean monthly excess over the Nifty 200 ${g(a.meanExcess)}, 90% interval ${g(a.ci90[0])} to ${g(a.ci90[1])}; smallest excess this sample could detect about ${g(a.minDetectable)} a month. Over the Nifty 500: mean ${g(b.meanExcess)}, interval ${g(b.ci90[0])} to ${g(b.ci90[1])}\n- Years beating the Nifty 200: ${a.yearsBeat} of ${a.years}\n- Diagnostic, same 30 names equal-weighted: ${f(e.sleeve)}, mean monthly excess over the Nifty 200 ${g(e.meanExcess)} (${g(e.ci90[0])} to ${g(e.ci90[1])})\n- Conditions ${JSON.stringify(c)}\n- By year (sleeve / Nifty 200): ${Object.entries(a.byYear).map(([y, o]) => `${y} ${f(o.sleeve)}/${f(o.index)}`).join(', ')}\n\n`;
}
const nse = 'data/replay/nse-momentum30-price.csv';
if (existsSync(nse)) { const rows = readFileSync(nse, 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')), m = new Map(rows.map((r) => [r[0], +r[1]])), me = monthEnds.filter((i) => tilt.eq[i] > 0 && m.has(dates[i])), a = [], b = [];
  for (let j = 1; j < me.length; j++) { a.push(tilt.eq[me[j]] / tilt.eq[me[j - 1]] - 1); b.push(m.get(dates[me[j]]) / m.get(dates[me[j - 1]]) - 1); }
  const ma = mean(a), mb = mean(b), cov = a.reduce((s, x, j) => s + (x - ma) * (b[j] - mb), 0), cor = cov / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0));
  out.replication = { months: a.length, correlation: cor, trackingDifferenceMonthly: ma - mb }; md += `## Replication metric against NSE's series\n- ${a.length} months; correlation of monthly returns ${cor.toFixed(3)} (target about 0.9); mean monthly tracking difference ${g(ma - mb)}\n`; }
else { out.replication = 'not run: NSE series not supplied'; md += `## Replication metric against NSE's series\nNot run: no NSE price series supplied (data/replay/nse-momentum30-price.csv).\n`; }
writeFileSync('data/replay/c129-momentum30.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C129-REPORT.md', md); console.log(md);
