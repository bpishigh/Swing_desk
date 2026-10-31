// C-121: the C-54 momentum selection held 3 and 6 monthly steps (overlapping equal-weight groups), always invested. One run, two horizons, no tuning. Registered in docs/backtests/manifest.json.
// Usage: node --max-old-space-size=8000 scripts/backtest-slow-momentum.mjs india|us
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { bootMean, mean, compound, BASE, eligible as indEligible, topShare, tierCost } from '../src/backtest/ind-base.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { spliceIndex } from '../src/backtest/index-splice.ts';
import { loadUs, usCost } from '../src/backtest/us-loader.ts';
const MKT = process.argv[2]; if (!['india', 'us'].includes(MKT)) { console.error('usage: india|us'); process.exit(2); }
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
let dates, N, series, S, from, to, costOf, benchIdx, snapshot, buildSignal, judged;
if (MKT === 'india') {
  const D = loadIndia('data/india', { pre2020: true, allSymbols: true }); ({ dates } = D); N = D.T; series = D.FH.series; snapshot = D.snapshot; from = '2011-01-01'; to = '2025-10-31';
  const nifty = {}, bse = {}; for (let y = 2010; y <= 2025; y++) { let o; try { o = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3]; for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3]; }
  benchIdx = spliceIndex(dates, nifty, bse).values; costOf = (p, m) => tierCost(p.value, m); judged = (d) => d <= '2019-12-31';
  buildSignal = (t) => { const hist = asOfHistories(D.days, t, D.res, D.allowed), el = indEligible(hist, t, BASE.skip); return { el, top: topShare(el, BASE.cut) }; };
} else {
  const D = loadUs(); ({ dates, N } = D); series = D.hist.series; snapshot = D.snapshot; from = '2018-01-01'; to = '2025-10-31'; benchIdx = D.spy; costOf = (p, m) => usCost(p.dv) * m; judged = () => true;
  const F = { minPrice: 10, minDV: 10e6, universe: 500, minSessions: 260, lookback: 252, skip: 21, cut: 0.10 }, med = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  buildSignal = (t) => { const out = [];
    for (const [sym, s] of series) { const c = s.c[t]; if (!(c >= F.minPrice)) continue; let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] === s.c[i]) n++; if (n < F.minSessions) continue;
      const vals = []; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) vals.push(s.c[i] * s.v[i]); if (vals.length < 15) continue; const dv = vals.reduce((a, b) => a + b, 0) / vals.length; if (dv < F.minDV) continue;
      const a = s.c[t - F.skip], b = s.c[t - F.lookback]; out.push({ sym, value: med(vals), dv, mom: a > 0 && b > 0 ? a / b - 1 : NaN }); }
    out.sort((x, y) => y.value - x.value || (x.sym < y.sym ? -1 : 1)); const el = out.slice(0, F.universe);
    const w = el.filter((p) => p.mom === p.mom).sort((x, y) => y.mom - x.mom || (x.sym < y.sym ? -1 : 1)); return { el, top: w.slice(0, Math.max(1, Math.ceil(w.length * F.cut))) }; };
}
S = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) S.push(i);
const hold = S.map((t) => ({ t, date: dates[t], entry: t + 1 })), M = hold.length;
const t0 = Date.now(), sig = hold.map((h) => buildSignal(h.t)); console.error(`${MKT}: ${M} signals built ${((Date.now() - t0) / 1000).toFixed(0)}s, data ${snapshot.hash}`);
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] === s.c[k]) return s.c[k]; return NaN; };
// one name's return over month m (entry m to entry m+1), net of half cost at its group's first month and last month
function groupMonth(list, k, m, nc, mult) {
  let sum = 0, n = 0; const e0 = hold[m].entry, e1 = hold[m + 1].entry;
  for (const p of list) { const s = series.get(p.sym); if (!s || !(s.c[e0] > 0)) continue; let c1 = s.c[e1]; if (!(c1 > 0)) { c1 = px(p.sym, e1); if (!(c1 > 0)) continue; }
    let r = c1 / s.c[e0] - 1; const cost = costOf(p, mult); if (m === k) r -= cost / 2; if (m === k + nc - 1 || m + 1 === M - 1) r -= cost / 2; sum += r; n++; }
  return n ? sum / n : NaN;
}
function portfolio(nc, mult) {   // overlapping groups, equal weight over the live groups
  const rows = []; for (let m = 0; m < M - 1; m++) { const v = []; for (let k = Math.max(0, m - nc + 1); k <= m; k++) { const g = groupMonth(sig[k].top, k, m, nc, mult); if (g === g) v.push(g); } rows.push({ m, date: hold[m].date, r: v.length ? mean(v) : NaN, live: Math.min(nc, m + 1) }); } return rows;
}
function bench(mult) {   // equal-weight eligible list, rebalanced monthly, always invested, cost on changes
  const rows = []; for (let m = 0; m < M - 1; m++) { const cur = sig[m].el, prev = new Set((sig[m - 1]?.el ?? []).map((p) => p.sym)), next = new Set(sig[m + 1].el.map((p) => p.sym)); let sum = 0, n = 0; const e0 = hold[m].entry, e1 = hold[m + 1].entry;
    for (const p of cur) { const s = series.get(p.sym); if (!s || !(s.c[e0] > 0)) continue; let c1 = s.c[e1]; if (!(c1 > 0)) { c1 = px(p.sym, e1); if (!(c1 > 0)) continue; } let r = c1 / s.c[e0] - 1; const cost = costOf(p, mult); if (!prev.has(p.sym)) r -= cost / 2; if (!next.has(p.sym) || m + 1 === M - 1) r -= cost / 2; sum += r; n++; }
    rows.push({ m, date: hold[m].date, r: n ? sum / n : NaN }); } return rows;
}
function evaluate(strat, uni, nc, keep) {
  const ix = strat.map((x, i) => i).filter((i) => i >= nc - 1 && keep(strat[i].date) && strat[i].r === strat[i].r && uni[i].r === uni[i].r);
  const s = ix.map((i) => strat[i].r), u = ix.map((i) => uni[i].r), ex = s.map((x, i) => x - u[i]), dates_ = ix.map((i) => strat[i].date), idxr = ix.map((i) => benchIdx[hold[i + 1].entry] / benchIdx[hold[i].entry] - 1);
  const [lo, hi] = bootMean(ex, 6, 5000, 20261031), drop3 = [...ex].sort((a, b) => b - a).slice(3), by = {};
  ex.forEach((x, i) => { const y = dates_[i].slice(0, 4); (by[y] ??= { ex: [], s: [], u: [], b: [] }).ex.push(x); by[y].s.push(s[i]); by[y].u.push(u[i]); by[y].b.push(idxr[i]); });
  const yrs = Object.keys(by).length, pos = Object.values(by).filter((o) => mean(o.ex) > 0).length;
  const e = { months: ix.length, from: dates_[0], to: dates_[dates_.length - 1], meanNet: mean(s), meanExUniverse: mean(ex), ci90: [lo, hi], meanExAfterDrop3: mean(drop3), compStrategy: compound(s), compUniverse: compound(u), compIndex: compound(idxr), years: yrs, yearsPositive: pos,
    byYear: Object.fromEntries(Object.entries(by).map(([y, o]) => [y, { months: o.ex.length, meanExcess: mean(o.ex), strategy: compound(o.s), universe: compound(o.u), index: compound(o.b) }])) };
  e.criteria = { meanExcessAboveZero: e.meanExUniverse > 0, ciLowAboveZero: lo > 0, aboveZeroAfterDropping3Months: e.meanExAfterDrop3 > 0, yearsPositiveAtLeastTwoThirds: pos >= Math.ceil((2 / 3) * yrs) }; e.pass = Object.values(e.criteria).every(Boolean); return e;
}
const out = { run: new Date().toISOString().slice(0, 10), market: MKT, data: snapshot, label: MKT === 'us' ? 'SURVIVOR-BIASED UPWARD' : 'India, delisted names kept', horizons: {} };
for (const nc of [3, 6]) {
  const B1 = bench(1), B2 = bench(2), P1 = portfolio(nc, 1), P2 = portfolio(nc, 2);
  const h = { judged: evaluate(P1, B1, nc, judged), doubleCostJudged: evaluate(P2, B2, nc, judged) }; if (MKT === 'india') h.reported2020to2025 = evaluate(P1, B1, nc, (d) => d > '2019-12-31');
  out.horizons[`${nc}months`] = h;
}
out.pass = Object.values(out.horizons).every((h) => h.judged.pass);
mkdirSync('data/replay', { recursive: true }); writeFileSync(`data/replay/c121-${MKT}.json`, JSON.stringify(out, null, 1) + '\n');
const f = (x) => (x * 100).toFixed(2) + '%'; let md = `# C-121 slower momentum, ${MKT} (${out.label})\n\nGroups held 3 or 6 monthly steps; always invested; excess over the equal-weight eligible list.\n\n`;
for (const [k, h] of Object.entries(out.horizons)) for (const [nm, e] of Object.entries(h)) md += `## ${k}, ${nm}: ${e.pass ? 'PASS' : 'FAIL'}\n- ${e.months} months ${e.from} to ${e.to}; mean net ${f(e.meanNet)}; mean excess ${f(e.meanExUniverse)}; 90% interval ${e.ci90.map(f).join(' to ')}; after dropping best three ${f(e.meanExAfterDrop3)}; years positive ${e.yearsPositive} of ${e.years}\n- Compounded: strategy ${f(e.compStrategy)}, eligible list ${f(e.compUniverse)}, index ${f(e.compIndex)}\n- Conditions ${JSON.stringify(e.criteria)}\n- By year (mean monthly excess): ${Object.entries(e.byYear).map(([y, o]) => `${y} ${f(o.meanExcess)}`).join(', ')}\n\n`;
md += `Market verdict (both horizons, judged window): ${out.pass ? 'PASS' : 'FAIL'}\n`; writeFileSync(`docs/replay/C121-${MKT}-REPORT.md`, md); console.log(md);
