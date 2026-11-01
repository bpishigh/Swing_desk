// C-134: the sector ranking on its own. Registered in docs/backtests/manifest.json (C-134-r1) before this run. One run, no tuning.
// Each month's first session: the production gate and score (src/engine/sectors.ts, normal mode, light fixed to green), top four held equal weight
// (fewer if fewer pass, cash at 0% if none), against the equal-weight average of all sectors. Price only, no costs: this tests the ranking, not an implementation.
// Usage: node scripts/backtest-sectors.mjs      (SMOKE=1 prints counts only)
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { rankSectors } from '../src/engine/sectors.ts';
import { firstSessions, bootMeanOf, yearsCompound, mean, compound } from '../src/backtest/groups.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), f = (x) => (x * 100).toFixed(2) + '%';
const IN = ['Nifty Auto', 'Nifty Bank', 'Nifty Energy', 'Nifty FMCG', 'Nifty IT', 'Nifty Media', 'Nifty Metal', 'Nifty Pharma', 'Nifty PSU Bank', 'Nifty Realty', 'Nifty Infrastructure', 'Nifty PSE'];
const US = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU'];
const sma = (c, i, n) => { if (i + 1 < n) return NaN; let s = 0; for (let k = i + 1 - n; k <= i; k++) { if (!(c[k] > 0)) return NaN; s += c[k]; } return s / n; };
function run(market, dates, series, bench, windows) {   // series: Map name -> closes aligned to dates (NaN when absent); bench: closes
  const M = firstSessions(dates, '2012-03-01', '2026-10-31'), months = [];
  for (let q = 0; q + 1 < M.length; q++) {
    const i = M[q], nx = M[q + 1]; if (!(bench[i - 63] > 0)) continue;
    const inputs = [...series].map(([name, c]) => ({ name, m1: (c[i] / c[i - 21] - 1) * 100, m3: (c[i] / c[i - 63] - 1) * 100, above50: c[i] > sma(c, i, 50), above200: c[i] > sma(c, i, 200) }));
    const ranked = rankSectors(inputs, (bench[i] / bench[i - 63] - 1) * 100, 'normal'), top = ranked.filter((r) => r.rank !== null && r.rank <= 4).map((r) => r.name);
    const ret = (c) => c[nx + 1] / c[i + 1] - 1, all = [...series.values()].map(ret).filter(Number.isFinite);
    if (!all.length || !(bench[i + 1] > 0) || !(bench[nx + 1] > 0)) continue;
    const held = top.map((n) => ret(series.get(n))).filter(Number.isFinite);
    months.push({ d: dates[i], sleeve: held.length ? mean(held) : 0, all: mean(all), bench: bench[nx + 1] / bench[i + 1] - 1, held: held.length });
  }
  return windows.map(([label, judged, from, to]) => {
    const m = months.filter((x) => x.d >= from && x.d <= to), ex = m.map((x) => x.sleeve - x.all), yrs = m.map((x) => x.d.slice(0, 4)), [lo, hi] = bootMeanOf(ex), yr = yearsCompound(yrs, m.map((x) => x.sleeve), m.map((x) => x.all));
    const c = { beatsAll: compound(m.map((x) => x.sleeve)) > compound(m.map((x) => x.all)), lowerAboveZero: lo > 0, yearsTwoThirds: yr.counted > 0 && yr.wins >= Math.ceil((2 / 3) * yr.counted) };
    return { market, label, judged, months: m.length, first: m[0]?.d, last: m.at(-1)?.d, sleeve: compound(m.map((x) => x.sleeve)), allSectors: compound(m.map((x) => x.all)), benchmark: compound(m.map((x) => x.bench)), meanExcess: mean(ex), ci90: [lo, hi], minDetectable: hi - mean(ex), yearsWin: yr.wins, years: yr.counted, byYear: yr.byYear, avgHeld: mean(m.map((x) => x.held)), emptyMonths: m.filter((x) => x.held === 0).length, conditions: c, pass: Object.values(c).every(Boolean) };
  });
}
const out = { run: new Date().toISOString().slice(0, 10), results: [] };
// India
{
  const o = (name) => { const m = {}; for (let y = 2012; y <= 2025; y++) { let j; try { j = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(j[name] ?? {})) m[d] = v[3]; } return m; };
  const b = o('Nifty 500'), dates = Object.keys(b).sort(), carry = (m) => { const a = new Float64Array(dates.length).fill(NaN); let last = NaN; dates.forEach((d, i) => { if (m[d] > 0) last = m[d]; a[i] = last; }); return a; };
  const ser = new Map(IN.map((n) => [n, carry(o(n))])), missing = IN.filter((n) => !Object.keys(o(n)).length);
  if (missing.length) throw new Error('missing sector indices: ' + missing);
  out.results.push(...run('India', dates, ser, carry(b), [['Jan 2013 to Dec 2019 (judged)', true, '2013-01-01', '2019-12-31'], ['Jan 2020 to Oct 2025 (reported)', false, '2020-01-01', '2025-10-31']]));
}
// US
{
  const bars = (s) => new Map(JSON.parse(gunzipSync(readFileSync(`data/us/hist-bench/${s}.json.gz`)).toString()).bars.map((x) => [x[0], x[1]]));
  const spy = bars('SPY'), dates = [...spy.keys()].sort(), al = (m) => Float64Array.from(dates, (d) => m.get(d) ?? NaN);
  out.results.push(...run('US', dates, new Map(US.map((s) => [s, al(bars(s))])), al(spy), [['Jan 2018 to Dec 2023 (judged)', true, '2018-01-01', '2023-12-31'], ['Jan 2024 to Oct 2026 (reported)', false, '2024-01-01', '2026-10-31']]));
}
if (process.env.SMOKE) { for (const r of out.results) console.log('SMOKE', r.market, r.label, r.months, r.first, r.last, 'avgHeld', r.avgHeld.toFixed(2), 'empty', r.emptyMonths); process.exit(0); }
let md = '# C-134: the sector ranking on its own\n\nTop four sectors by the desk gate and score (light fixed to green), equal weight, against the equal-weight average of all sectors. Price only, no costs.\n\n';
for (const r of out.results) md += `## ${r.market}: ${r.label}: ${r.judged ? (r.pass ? 'PASS' : 'FAIL') : 'reported, not judged'}\n- ${r.months} months ${r.first} to ${r.last}; average sectors held ${r.avgHeld.toFixed(2)}, ${r.emptyMonths} months in cash\n- Compounded: top four ${f(r.sleeve)}; all sectors equal weight ${f(r.allSectors)}; benchmark ${f(r.benchmark)}\n- Mean monthly excess over all sectors ${f(r.meanExcess)}; 90% interval ${f(r.ci90[0])} to ${f(r.ci90[1])}; smallest this sample could detect about ${f(r.minDetectable)}\n- Years beating all sectors: ${r.yearsWin} of ${r.years}\n- Conditions ${JSON.stringify(r.conditions)}\n\n`;
writeFileSync('data/replay/c134-sectors.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C134-REPORT.md', md); console.log(md);
