// C-75 sector rotation sleeve vs the Nifty 500. Registered in the change log and the run manifest (C-75-r1) before running.
// Each month-end a sector qualifies if its 63-session return beats the Nifty 500's, is above zero, and its close is above its 50-session average. Qualifiers are ranked by 2 x 63-session + 21-session return;
// the top two are held equal-weight; none qualifying means the Nifty 500. Trade at the next close, 0.30% of traded value, plus 0.30% a year expense drag on the sector arm. Holdout hidden until revealed.
// Usage: node scripts/replay-sector-rotation.mjs --run=C-75-r1
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadManifest, gate } from '../src/backtest/manifest.ts';
const RUN = process.argv.find((a) => a.startsWith('--run='))?.slice(6);
const entry = loadManifest().runs.find((r) => r.id === RUN); if (!entry) { console.error('pass --run=<registered id>'); process.exit(1); }
const SECT = ['Nifty Auto', 'Nifty Bank', 'Nifty Consumer Durables', 'Nifty Energy', 'Nifty FMCG', 'Nifty Financial Services', 'Nifty IT', 'Nifty Infrastructure', 'Nifty Media', 'Nifty Metal', 'Nifty Oil & Gas', 'Nifty PSE', 'Nifty PSU Bank', 'Nifty Pharma', 'Nifty Realty'], BENCH = 'Nifty 500';
const px = Object.fromEntries([...SECT, BENCH].map((k) => [k, {}]));
for (let y = 2020; y <= 2025; y++) { const j = JSON.parse(readFileSync(`data/india/idx-hist/idx-${y}.json`, 'utf8')); for (const k of Object.keys(px)) for (const [d, v] of Object.entries(j[k] || {})) px[k][d] = v[3]; }
const dates = Object.keys(px[BENCH]).filter((d) => d <= '2025-10-16' && SECT.every((k) => px[k][d] != null)).sort(), T = dates.length;
const c = Object.fromEntries(Object.keys(px).map((k) => [k, dates.map((d) => px[k][d])]));
const ret = (k, t, n) => (t >= n ? c[k][t] / c[k][t - n] - 1 : null), sma = (k, t, n) => { if (t < n - 1) return null; let s = 0; for (let i = t - n + 1; i <= t; i++) s += c[k][i]; return s / n; };
const monthEnd = new Set(); for (let t = 0; t < T - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7)) monthEnd.add(t);
function pick(t) {
  const b3 = ret(BENCH, t, 63); if (b3 === null) return null;
  const q = SECT.map((k) => ({ k, r3: ret(k, t, 63), r1: ret(k, t, 21), m: sma(k, t, 50) })).filter((x) => x.r3 !== null && x.m !== null && x.r3 > b3 && x.r3 > 0 && c[x.k][t] > x.m).sort((a, b) => (2 * b.r3 + b.r1) - (2 * a.r3 + a.r1)).slice(0, 2);
  return q.length ? q.map((x) => x.k) : [BENCH];
}
function simulate(cost, drag) {
  const dd = Math.pow(1 - drag, 1 / 252); let units = {}, val = 100, started = false, pending = null, turn = 0; const out = [];
  const iStart = 64;
  for (let t = iStart; t < T; t++) {
    if (!started) { units = { [BENCH]: val / c[BENCH][t] }; started = true; }
    let v = Object.entries(units).reduce((a, [k, u]) => a + u * c[k][t], 0);
    if (drag && started) { for (const k of Object.keys(units)) if (k !== BENCH) units[k] *= dd; v = Object.entries(units).reduce((a, [k, u]) => a + u * c[k][t], 0); }
    if (pending) {
      const target = pending; pending = null; const tw = Object.fromEntries(target.map((k) => [k, 1 / target.length])); let traded = 0;
      const cur = Object.fromEntries(Object.entries(units).map(([k, u]) => [k, u * c[k][t]]));
      for (const k of new Set([...Object.keys(cur), ...Object.keys(tw)])) traded += Math.abs((tw[k] ?? 0) * v - (cur[k] ?? 0));
      const vAfter = v - traded * cost; units = Object.fromEntries(Object.keys(tw).map((k) => [k, (vAfter * tw[k]) / c[k][t]])); v = vAfter; turn += traded / 100;
    }
    if (monthEnd.has(t)) pending = pick(t);
    out.push({ d: dates[t], v });
  }
  out.turn = turn; return out;
}
function bench() { let u = 100 / c[BENCH][64]; return Array.from({ length: T - 64 }, (_, i) => ({ d: dates[64 + i], v: u * c[BENCH][64 + i] })); }
const metrics = (rows, from, to) => { const r = rows.filter((p) => p.d >= from && p.d <= to); if (r.length < 2) return null; const days = (Date.parse(r.at(-1).d) - Date.parse(r[0].d)) / 86400000; let hi = r[0].v, dd = 0; for (const p of r) { hi = Math.max(hi, p.v); dd = Math.min(dd, p.v / hi - 1); } return { cagr: Math.pow(r.at(-1).v / r[0].v, 365.25 / days) - 1, dd }; };
const pct = (v) => (v * 100).toFixed(2) + '%';
const [fa, fb] = entry.fit, [ha, hb] = entry.holdout, years = [['2020-01-01', '2020-12-31'], ['2021-01-01', '2021-12-31'], ['2022-01-01', '2022-12-31'], ['2023-01-01', '2023-12-31']];
const B = bench(), g = gate(entry, B, (p) => p.d), revealed = !!g.holdout;
console.log(`${RUN} | ${T} sessions ${dates[0]}..${dates[T - 1]} | fit ${g.fit.length} sessions | holdout ${revealed ? g.holdout.length : 'hidden (' + g.hidden + ' sessions)'}`);
const out = { run: RUN, runs: {} };
for (const cost of [0.003, 0.006]) {
  const A = simulate(cost, 0.003), one = (from, to) => { const s = metrics(A, from, to), b = metrics(B, from, to); return s && b ? { S: s, B: b, d: s.cagr - b.cagr, ddWorse: b.dd - s.dd } : null; };
  const fit = one(fa, fb), ys = years.map(([a, b]) => one(a, b)), ahead = ys.filter((y) => y && y.d > 0).length, ok = fit.d >= 0.02 && fit.ddWorse <= 0.03 && ahead >= 3;
  out.runs[cost] = { fit, years: ys.map((y) => y && y.d), ahead, ok, turnover: A.turn }; if (revealed) out.runs[cost].holdout = one(ha, hb);
  console.log(`FIT cost ${cost}: Nifty 500 ${pct(fit.B.cagr)} dd ${pct(fit.B.dd)} | sector sleeve ${pct(fit.S.cagr)} dd ${pct(fit.S.dd)} | sleeve minus Nifty 500 ${pct(fit.d)}, drawdown worse by ${pct(fit.ddWorse)} | ahead ${ahead}/4 years [${ys.map((y) => (y ? pct(y.d) : 'n/a')).join(', ')}] | turnover ${A.turn.toFixed(1)}x | ${ok ? 'meets bars' : 'misses'}`);
}
out.verdict = out.runs[0.003].ok && out.runs[0.006].ok ? 'PASS' : 'FAIL'; console.log(`FIT RULE: ${out.verdict}`);
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/sector-rotation.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), out }, null, 1) + '\n');
