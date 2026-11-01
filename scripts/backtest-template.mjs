// C-135: the trend template on its own. Registered in docs/backtests/manifest.json (C-135-r1) before this run. One run, no tuning.
// Each month's first session: the 500 most traded names on the eligible list (India as-of list as C-128/C-129; US eligibleUs as C-131), split into those that pass the
// trend template and those that fail it; equal weight; next close to next month's next close; each group pays the round-trip cost tier every month.
// Usage: node --max-old-space-size=7000 scripts/backtest-template.mjs      (SMOKE=1 prints counts only; needs /tmp/c128-el-india.json or rebuilds it, ~20 min)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { loadUs, usCost } from '../src/backtest/us-loader.ts';
import { eligible as indEligible, BASE, tierCost } from '../src/backtest/ind-base.ts';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { eligibleUs } from '../src/engine/momentum-sleeve.ts';
import { firstSessions, bootMeanOf, yearsCompound, mean, compound } from '../src/backtest/groups.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), f = (x) => (x * 100).toFixed(2) + '%';
const avg = (c, t, n) => { let s = 0; for (let k = t - n + 1; k <= t; k++) { const v = c[k]; if (!(v > 0)) return NaN; s += v; } return s / n; };
/** Trend template (Engine Rules, India stock scan); null when the history is incomplete. */
function template(c, t) {
  if (t < 252 + 21) return null; const p = c[t]; if (!(p > 0)) return null;
  const s50 = avg(c, t, 50), s150 = avg(c, t, 150), s200 = avg(c, t, 200), s200b = avg(c, t - 21, 200); if (![s50, s150, s200, s200b].every(Number.isFinite)) return null;
  let lo = Infinity, hi = -Infinity; for (let k = t - 251; k <= t; k++) { const v = c[k]; if (!(v > 0)) return null; if (v < lo) lo = v; if (v > hi) hi = v; }
  return p > s150 && p > s200 && s150 > s200 && s200 > s200b && s50 > s150 && s50 > s200 && p > s50 && p >= 1.3 * lo && p >= 0.75 * hi;
}
function run(market, dates, lists, series, costOf, windows, MIN = 200, TOP = 500) {   // lists: [{t, list:[{sym,value}]}] one per signal month in time order; series: Map sym -> {c}
  const months = [];
  for (let q = 0; q + 1 < lists.length; q++) {
    const { t, list } = lists[q], nx = lists[q + 1].t; if (list.length < MIN) continue;
    const pass = [], fail = [], all = [];
    for (const { sym, value } of list.slice(0, TOP)) {
      const s = series.get(sym); if (!s) continue; const tp = template(s.c, t), a = s.c[t + 1], b = s.c[nx + 1]; if (tp === null || !(a > 0) || !(b > 0)) continue;
      const r = b / a - 1 - costOf(value); all.push(r); (tp ? pass : fail).push(r);
    }
    if (pass.length >= 20 && fail.length >= 20) months.push({ d: dates[t], pass: mean(pass), fail: mean(fail), all: mean(all), nP: pass.length, nF: fail.length });
  }
  return windows.map(([label, judged, from, to]) => {
    const m = months.filter((x) => x.d >= from && x.d <= to), diff = m.map((x) => x.pass - x.fail), yrs = m.map((x) => x.d.slice(0, 4)), [lo, hi] = bootMeanOf(diff), yr = yearsCompound(yrs, m.map((x) => x.pass), m.map((x) => x.fail));
    const cp = compound(m.map((x) => x.pass)), cf = compound(m.map((x) => x.fail)), ca = compound(m.map((x) => x.all));
    const c = { passBeatsFail: cp > cf, lowerAboveZero: lo > 0, yearsTwoThirds: yr.counted > 0 && yr.wins >= Math.ceil((2 / 3) * yr.counted), passBeatsUniverse: cp > ca };
    return { market, label, judged, months: m.length, first: m[0]?.d, last: m.at(-1)?.d, avgPass: mean(m.map((x) => x.nP)), avgFail: mean(m.map((x) => x.nF)), passShare: mean(m.map((x) => x.nP / (x.nP + x.nF))), pass: cp, fail: cf, universe: ca, meanDiff: mean(diff), ci90: [lo, hi], minDetectable: hi - mean(diff), yearsWin: yr.wins, years: yr.counted, byYear: yr.byYear, conditions: c, passed: Object.values(c).every(Boolean) };
  });
}
const out = { run: new Date().toISOString().slice(0, 10), results: [] };
// India
{
  const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), dates = D.dates, N = D.T, series = D.FH.series, M = firstSessions(dates, '2011-01-01', '2025-10-31');
  const cache = '/tmp/c128-el-india.json'; let EL;
  if (existsSync(cache)) EL = R(cache); else { EL = M.map((t) => indEligible(asOfHistories(D.days, t, D.res, D.allowed), t, BASE.skip).map((p) => ({ sym: p.sym, value: p.value }))); writeFileSync(cache, JSON.stringify(EL)); }
  if (EL.length !== M.length) throw new Error(`list count ${EL.length} != signals ${M.length}`);
  out.results.push(...run('India', dates, M.map((t, k) => ({ t, list: EL[k] })), series, (v) => tierCost(v), [['Jan 2011 to Dec 2019 (judged)', true, '2011-01-01', '2019-12-31'], ['Jan 2020 to Oct 2025 (reported)', false, '2020-01-01', '2025-10-31']]));
}
// US
{
  const D = loadUs(), dates = D.dates, series = D.hist.series, M = firstSessions(dates, '2017-12-01', '2026-10-31');
  const lists = M.map((t) => ({ t, list: eligibleUs(series, t) }));
  out.results.push(...run('US', dates, lists, series, (v) => usCost(v), [['Jan 2018 to Dec 2023 (judged)', true, '2018-01-01', '2023-12-31'], ['Jan 2024 to Oct 2026 (reported)', false, '2024-01-01', '2026-10-31']]));
}
if (process.env.SMOKE) { for (const r of out.results) console.log('SMOKE', r.market, r.label, r.months, r.first, r.last, 'avgPass', r.avgPass.toFixed(1), 'avgFail', r.avgFail.toFixed(1)); process.exit(0); }
let md = '# C-135: the trend template on its own\n\nPass group against fail group among the 500 most traded names, equal weight, monthly, each group charged the round-trip cost tier every month. India lists as-of and include delisted names; the US store holds only companies listed today (survivor bias).\n\n';
for (const r of out.results) md += `## ${r.market}: ${r.label}: ${r.judged ? (r.passed ? 'PASS' : 'FAIL') : 'reported, not judged'}\n- ${r.months} months ${r.first} to ${r.last}; average names passing ${r.avgPass.toFixed(0)}, failing ${r.avgFail.toFixed(0)} (pass share ${(r.passShare * 100).toFixed(0)}%)\n- Compounded after costs: pass ${f(r.pass)}; fail ${f(r.fail)}; whole universe ${f(r.universe)}\n- Mean monthly difference (pass minus fail) ${f(r.meanDiff)}; 90% interval ${f(r.ci90[0])} to ${f(r.ci90[1])}; smallest this sample could detect about ${f(r.minDetectable)}\n- Years pass beat fail: ${r.yearsWin} of ${r.years}\n- Conditions ${JSON.stringify(r.conditions)}\n\n`;
writeFileSync('data/replay/c135-template.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C135-REPORT.md', md); console.log(md);
