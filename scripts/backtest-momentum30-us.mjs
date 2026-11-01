// C-131: the C-129 momentum sleeve method on US stocks, against SPY. Registered in docs/backtests/manifest.json as C-131-r1 before this run. One run, no tuning.
// The store holds companies listed today only (survivor bias): a pass cannot confirm the factor, a fail is the informative result.
// Usage: node --max-old-space-size=7000 scripts/backtest-momentum30-us.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { bootMean, mean } from '../src/backtest/ind-base.ts';
import { loadUs, usCost } from '../src/backtest/us-loader.ts';
import { volAdj, zscores, capped } from '../src/engine/momentum-sleeve.ts';
const f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x * 100).toFixed(2) + '%';
const UNI = 200, HOLD = 30, KEEP = 45, W6 = 126, W12 = 252, CAPW = 0.05, CAPX = 5, MINPX = 5, MINVAL = 20e6, MINSESS = 260;
const D = loadUs(), { dates, N, spy } = D, series = D.hist.series, from = '2017-10-01', to = '2026-10-31';
const carry = (a) => { for (let i = 1; i < a.length; i++) if (!(a[i] > 0)) a[i] = a[i - 1]; return a; };
const qb = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/QQQ.json.gz')).toString()).bars, qi = new Map(qb.map((b) => [b[0], b[1]])), qqq = carry(Float64Array.from(dates, (d) => qi.get(d) ?? NaN)), spyC = carry(Float64Array.from(spy));
const M = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) M.push(i);
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const median = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
function eligible(t) {   // 200 most traded listed companies on night t, as the C-129 list but in dollars
  const out = [];
  for (const [sym, s] of series) {
    const c = s.c[t]; if (!(c >= MINPX)) continue;
    let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] > 0) n++; if (n < MINSESS) continue;
    const vals = []; for (let i = t - 19; i <= t; i++) if (i >= 0 && s.c[i] > 0 && s.v[i] >= 0) vals.push(s.c[i] * s.v[i]); if (vals.length < 15) continue;
    const value = median(vals); if (value >= MINVAL) out.push({ sym, value });
  }
  return out.sort((a, b) => b.value - a.value || (a.sym < b.sym ? -1 : 1));
}
const signals = [];   // review sessions (first session of June and December) with a full list
for (const t of M) if (['06', '12'].includes(dates[t].slice(5, 7))) { const el = eligible(t); if (el.length >= UNI) signals.push({ t, el }); }
if (!signals.length) throw new Error('no review date with a full list');
function select(k, prev) {
  const { t, el } = signals[k], uni = el.slice(0, UNI), rows = [];
  for (const p of uni) { const s = series.get(p.sym); const a6 = volAdj(s.c, t, W6), a12 = volAdj(s.c, t, W12); if (a6 === null || a12 === null) continue; rows.push({ ...p, a6, a12 }); }
  const z6 = zscores(rows.map((r) => r.a6)), z12 = zscores(rows.map((r) => r.a12)); rows.forEach((r, i) => { r.s = (z6[i] + z12[i]) / 2; r.mult = r.s >= 0 ? 1 + r.s : 1 / (1 - r.s); });
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1)); rows.forEach((r, i) => { r.rank = i + 1; });
  const keep = rows.filter((r) => prev.has(r.sym) && r.rank <= KEEP), chosen = new Set(keep.map((r) => r.sym)); for (const r of rows) { if (chosen.size >= HOLD) break; if (!chosen.has(r.sym)) chosen.add(r.sym); }
  return { picks: rows.filter((r) => chosen.has(r.sym)), total: uni.reduce((a, b) => a + b.value, 0) };
}
function run(weighting) {
  let cash = 1, held = new Map(), prev = new Set(); const lastValue = new Map(), eq = new Array(N).fill(NaN); let first = null; const turn = [], costs = [], names = [];
  const value = (i) => { let v = cash; for (const [sym, sh] of held) { const p = px(sym, i); v += sh * (p > 0 ? p : 0); } return v; };
  const sigAt = new Map(signals.map((s, k) => [s.t + 1, k]));
  for (let i = 0; i < N; i++) {
    if (sigAt.has(i)) {
      const k = sigAt.get(i), sel = select(k, prev), V = value(i); first ??= i; names.push(sel.picks.length);
      for (const p of signals[k].el) lastValue.set(p.sym, p.value);
      let w; if (weighting === 'equal') w = sel.picks.map(() => 1 / sel.picks.length); else { const raw = sel.picks.map((r) => r.value * r.mult); w = capped(raw, sel.picks.map((r) => Math.min(CAPW, CAPX * r.value / sel.total))); if (w.reduce((a, b) => a + b, 0) < 1 - 1e-9) w = capped(raw, raw.map(() => CAPW)); }
      const target = new Map(sel.picks.map((r, j) => [r.sym, w[j] * V])), all = new Set([...held.keys(), ...target.keys()]); let traded = 0, cost = 0;
      for (const sym of all) { const p = px(sym, i); if (!(p > 0)) continue; const cur = (held.get(sym) ?? 0) * p, tgt = target.get(sym) ?? 0, d = Math.abs(tgt - cur); traded += d; cost += d * usCost(lastValue.get(sym) ?? 0) / 2; }
      turn.push(traded / (2 * V)); costs.push({ d: dates[i], frac: cost / V }); const V2 = V - cost; held = new Map(); cash = 0;
      for (const [sym, amt] of target) { const p = px(sym, i); if (p > 0) held.set(sym, (amt / V) * V2 / p); else cash += (amt / V) * V2; }
      prev = new Set(held.keys());
    }
    if (first !== null && i >= first) eq[i] = value(i);
  }
  return { eq, first, turnover: mean(turn), holdings: mean(names), costs };
}
const monthEnds = []; for (let i = 0; i < N - 1; i++) if (dates[i].slice(0, 7) !== dates[i + 1].slice(0, 7)) monthEnds.push(i);
function stats(eqArr, idxArr, d0, d1) {
  const me = monthEnds.filter((i) => dates[i] >= d0 && dates[i] <= d1 && eqArr[i] > 0), ret = [], ir = [], yr = {}, yi = {};
  for (let j = 1; j < me.length; j++) { const a = me[j - 1], b = me[j], r = eqArr[b] / eqArr[a] - 1, q = idxArr[b] / idxArr[a] - 1; ret.push(r); ir.push(q); const y = dates[b].slice(0, 4); yr[y] = (yr[y] ?? 1) * (1 + r); yi[y] = (yi[y] ?? 1) * (1 + q); }
  const ex = ret.map((r, j) => r - ir[j]), [lo, hi] = bootMean(ex, 6, 5000, 20261101), sd = Math.sqrt(ex.reduce((a, b) => a + (b - mean(ex)) ** 2, 0) / (ex.length - 1)), yrs = Object.keys(yr), beat = yrs.filter((y) => yr[y] > yi[y]).length;
  let pk = 1, mdd = 0, v = 1; for (const r of ret) { v *= 1 + r; pk = Math.max(pk, v); mdd = Math.min(mdd, v / pk - 1); }
  return { months: ret.length, from: dates[me[0]], to: dates[me.at(-1)], sleeve: ret.reduce((a, r) => a * (1 + r), 1) - 1, index: ir.reduce((a, r) => a * (1 + r), 1) - 1, meanExcess: mean(ex), ci90: [lo, hi], minDetectable: 1.645 * sd / Math.sqrt(ex.length), yearsBeat: beat, years: yrs.length, maxFall: mdd, byYear: Object.fromEntries(yrs.map((y) => [y, { sleeve: yr[y] - 1, index: yi[y] - 1 }])) };
}
const tilt = run('tilt'), equal = run('equal');
const out = { run: new Date().toISOString().slice(0, 10), assumptions: 'see change log C-131; survivor bias: delisted stocks missing', firstBuild: dates[tilt.first], reviews: signals.map((s) => dates[s.t]), turnoverPerRebalance: tilt.turnover, avgHoldings: tilt.holdings, windows: [] };
let md = `# C-131 US momentum sleeve (the C-129 method on US stocks)\n\nTop 200 listed companies by dollar volume, top 30 by score, semi-annual (June, December), no cash rule or stops, US cost tiers. Price only. **Survivor bias: the store holds only companies listed today, so these results are flattered; a pass cannot confirm the factor.**\n\nFirst build ${dates[tilt.first]}; ${signals.length} review dates; average one-way turnover per rebalance ${f(tilt.turnover)}; average holdings ${tilt.holdings.toFixed(1)}.\n\n`;
for (const [label, d0, d1, judged] of [['US Dec 2017 to Dec 2023', '2017-12-01', '2023-12-31', true], ['US 2024 to Oct 2026 (reported)', '2024-01-01', '2026-10-31', false]]) {
  const a = stats(tilt.eq, spyC, d0, d1), q = stats(tilt.eq, qqq, d0, d1), e = stats(equal.eq, spyC, d0, d1), c = { beatsIndex: a.sleeve > a.index, meanExcessAboveZero: a.meanExcess > 0, ciLowAboveZero: a.ci90[0] > 0, twoThirdsYears: a.yearsBeat >= Math.ceil((2 / 3) * a.years) }, pass = Object.values(c).every(Boolean);
  out.windows.push({ label, judged, pass, criteria: c, vsSPY: a, vsQQQ: { sleeve: q.sleeve, index: q.index, meanExcess: q.meanExcess, ci90: q.ci90 }, equalWeightDiagnostic: { sleeve: e.sleeve, meanExcessVsSPY: e.meanExcess, ci90: e.ci90 } });
  md += `## ${label}: ${pass ? 'PASS' : 'FAIL'}${judged ? '' : ' (not judged)'}\n- ${a.months} months ${a.from} to ${a.to}. Sleeve ${f(a.sleeve)}; SPY ${f(a.index)}; QQQ ${f(q.index)}. Max fall ${f(a.maxFall)}\n- Mean monthly excess over SPY ${g(a.meanExcess)}, 90% interval ${g(a.ci90[0])} to ${g(a.ci90[1])}; smallest excess this sample could detect about ${g(a.minDetectable)} a month. Over QQQ: mean ${g(q.meanExcess)}, interval ${g(q.ci90[0])} to ${g(q.ci90[1])}\n- Years beating SPY: ${a.yearsBeat} of ${a.years}\n- Diagnostic, same 30 names equal-weighted: ${f(e.sleeve)}, mean monthly excess over SPY ${g(e.meanExcess)} (${g(e.ci90[0])} to ${g(e.ci90[1])})\n- Conditions ${JSON.stringify(c)}\n- By year (sleeve / SPY): ${Object.entries(a.byYear).map(([y, o]) => `${y} ${f(o.sleeve)}/${f(o.index)}`).join(', ')}\n\n`;
}
const cost = tilt.costs.reduce((v, c) => v + c.frac, 0), yrsN = (new Date(dates.at(-1)) - new Date(dates[tilt.first])) / (365.25 * 864e5);
out.costs = { rebalances: tilt.costs.length, avgPerRebalance: cost / tilt.costs.length, perYear: cost / yrsN }; md += `Costs: ${tilt.costs.length} rebalances, average ${g(cost / tilt.costs.length)} of the portfolio per rebalance, about ${g(cost / yrsN)} a year.\n`;
writeFileSync('data/replay/c131-momentum30-us.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C131-REPORT.md', md); console.log(md);
