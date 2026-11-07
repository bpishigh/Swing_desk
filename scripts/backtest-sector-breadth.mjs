// C-152: sector breadth ranking on its own. Registered in docs/backtests/manifest.json (C-152-r1) before this run. One run, no tuning.
// Each month's first session: per industry (data/india/segments.json, current list: survivorship bias), breadth = share of stocks above their own 50-day;
// top four by breadth (ties: median 3-month return), equal weight, against the equal-weight average of all eligible industries. Price only, no costs.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { firstSessions, bootMeanOf, yearsCompound, mean, compound } from '../src/backtest/groups.ts';
const f = (x) => (x * 100).toFixed(2) + '%';
const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), { dates } = D, series = D.FH.series;
const ind = JSON.parse(readFileSync('data/india/segments.json', 'utf8')).industry;
const groups = new Map(); for (const [s, g] of Object.entries(ind)) { if (!series.get(s)) continue; (groups.get(g) ?? groups.set(g, []).get(g)).push(s); }
const px = (s, i) => { const c = series.get(s)?.c; if (!c) return NaN; for (let k = i; k >= Math.max(0, i - 10); k--) if (c[k] > 0) return c[k]; return NaN; };
const sma50 = (s, i) => { let n = 0, t = 0; for (let k = i - 49; k <= i; k++) { const v = px(s, k); if (v > 0) { t += v; n++; } } return n >= 40 ? t / n : NaN; };
const M = firstSessions(dates, '2012-03-01', '2026-10-31'), months = [];
for (let q = 0; q + 1 < M.length; q++) {
  const i = M[q], nx = M[q + 1]; if (i < 260) continue;
  const rows = [];
  for (const [g, syms] of groups) {
    const ok = syms.filter((s) => px(s, i) > 0 && sma50(s, i) > 0 && px(s, i + 1) > 0 && px(s, nx + 1) > 0);
    if (ok.length < 8) continue;
    const br = ok.filter((s) => px(s, i) > sma50(s, i)).length / ok.length;
    const r3 = ok.map((s) => px(s, i) / px(s, i - 63) - 1).filter(Number.isFinite).sort((a, b) => a - b), med = r3[Math.floor(r3.length / 2)] ?? 0;
    rows.push({ g, br, med, ret: mean(ok.map((s) => px(s, nx + 1) / px(s, i + 1) - 1)) });
  }
  if (rows.length < 5) continue;
  const top = [...rows].sort((a, b) => b.br - a.br || b.med - a.med).slice(0, 4);
  months.push({ d: dates[i], sleeve: mean(top.map((r) => r.ret)), all: mean(rows.map((r) => r.ret)), n: rows.length, topNames: top.map((r) => r.g) });
}
const windows = [['Jan 2013 to Dec 2019 (judged)', true, '2013-01-01', '2019-12-31'], ['Jan 2020 to Oct 2025 (reported)', false, '2020-01-01', '2025-10-31']];
const out = { run: new Date().toISOString().slice(0, 10), results: windows.map(([label, judged, from, to]) => {
  const m = months.filter((x) => x.d >= from && x.d <= to), ex = m.map((x) => x.sleeve - x.all), [lo, hi] = bootMeanOf(ex), yr = yearsCompound(m.map((x) => x.d.slice(0, 4)), m.map((x) => x.sleeve), m.map((x) => x.all));
  const c = { beatsAll: compound(m.map((x) => x.sleeve)) > compound(m.map((x) => x.all)), lowerAboveZero: lo > 0, yearsTwoThirds: yr.counted > 0 && yr.wins >= Math.ceil((2 / 3) * yr.counted) };
  return { label, judged, months: m.length, first: m[0]?.d, last: m.at(-1)?.d, avgIndustries: mean(m.map((x) => x.n)), sleeve: compound(m.map((x) => x.sleeve)), allIndustries: compound(m.map((x) => x.all)), meanExcess: mean(ex), ci90: [lo, hi], years: { counted: yr.counted, wins: yr.wins }, conditions: c, pass: c.beatsAll && c.lowerAboveZero && c.yearsTwoThirds };
}) };
let md = '# C-152: sector breadth ranking on its own (India)\n\nTop four industries by share of stocks above their own 50-day, equal weight, against the equal-weight average of all eligible industries. Current-list industries (survivorship bias). Price only, no costs.\n\n';
for (const r of out.results) md += `## ${r.label}: ${r.judged ? (r.pass ? 'PASS' : 'FAIL') : 'reported, not judged'}\n- ${r.months} months ${r.first} to ${r.last}; about ${r.avgIndustries.toFixed(1)} industries eligible\n- Compounded: top four ${f(r.sleeve)}; all industries ${f(r.allIndustries)}\n- Mean monthly excess ${f(r.meanExcess)}, 90% interval ${f(r.ci90[0])} to ${f(r.ci90[1])}; beat in ${r.years.wins} of ${r.years.counted} years\n- Conditions: ${JSON.stringify(r.conditions)}\n\n`;
writeFileSync('data/replay/c152-sector-breadth-india.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C152-REPORT.md', md); console.log(md);
