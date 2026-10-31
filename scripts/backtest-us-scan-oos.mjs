// C-119 test (b): the frozen US-SCAN-1 run night by night on the Nasdaq-sourced store, signals 2018-01-01 to 2025-09-30. SURVIVOR-BIASED UPWARD (C-116, C-119).
// Light fixed to Yellow (no past light history), SIC groups from today's file. Picks: the top-10 list (set B, judged) and the Ready list (set A, reported). Entry next close, exit 20 sessions later,
// a ticker once per 20 sessions, tiered cost by 20-day dollar volume, excess over SPY. Usage: node --max-old-space-size=8000 scripts/backtest-us-scan-oos.mjs [--limit=N] [--leak]
import { writeFileSync, mkdirSync } from 'node:fs';
import { runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';
import { loadUs, truncatedHist, usCost } from '../src/backtest/us-loader.ts';
import { bootMean, mean } from '../src/backtest/ind-base.ts';
import { formatReport } from '../src/backtest/report.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d, LIMIT = +arg('limit', 0), LEAK = process.argv.includes('--leak');
const D = loadUs(), { dates, N, spy, types, sic, hist } = D, HOLD = 20, LIGHT = 'yellow';
const t0i = D.first('2018-01-01'); let t1i = N - 1; while (dates[t1i] > '2025-09-30') t1i--;
let nights = []; for (let t = t0i; t <= t1i && t + 1 + HOLD < N; t++) nights.push(t); if (LIMIT) nights = nights.slice(0, LIMIT);
console.error(`sessions ${N} (${dates[0]} to ${dates[N - 1]}), nights ${nights.length} (${dates[nights[0]]} to ${dates[nights[nights.length - 1]]}), data ${D.snapshot.hash}`);
const dv20 = (s, t) => { let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) { a += s.c[i] * s.v[i]; n++; } return n ? a / n : 0; };
if (LEAK) {   // integrity: the scan on the night's truncated store gives the same lists as on a store cut at the night's own file (here: same arrays, so test the carried state: prev={} vs the live chain is not compared); check determinism and no use of later bars
  let bad = 0; const picks = [nights[Math.floor(nights.length * 0.2)], nights[Math.floor(nights.length * 0.5)], nights[Math.floor(nights.length * 0.8)]];
  for (const t of picks) {
    const a = runScan({ hist: truncatedHist(hist, t), types, sic, light: LIGHT, prev: {} });
    const cut = { dates: dates.slice(0, t + 1), series: new Map([...hist.series].map(([k, s]) => [k, { c: Float64Array.from(s.c.subarray(0, t + 1)), h: Float64Array.from(s.h.subarray(0, t + 1)), l: Float64Array.from(s.l.subarray(0, t + 1)), v: Float64Array.from(s.v.subarray(0, t + 1)) }])) };
    const b = runScan({ hist: cut, types, sic, light: LIGHT, prev: {} }), names = (o) => [...o.ready, ...o.watch].map((c) => c.sym).join();
    // and with every later bar overwritten by garbage in a copy that is still the full length: the result must not move
    const poisoned = { dates: dates.slice(0, t + 1), series: new Map([...hist.series].map(([k, s]) => { const c = Float64Array.from(s.c), h = Float64Array.from(s.h), l = Float64Array.from(s.l), v = Float64Array.from(s.v); for (let i = t + 1; i < N; i++) { c[i] = 1; h[i] = 1; l[i] = 1; v[i] = 1; } return [k, { c: c.subarray(0, t + 1), h: h.subarray(0, t + 1), l: l.subarray(0, t + 1), v: v.subarray(0, t + 1) }]; })) };
    const c = runScan({ hist: poisoned, types, sic, light: LIGHT, prev: {} }), same = names(a) === names(b) && names(b) === names(c); if (!same) bad++; console.log(dates[t], same ? 'same' : 'DIFFERENT', [...a.ready, ...a.watch].length, 'listed');
  }
  console.log(bad ? `LEAK CHECK FAIL: ${bad}` : `LEAK CHECK PASS: ${picks.length} nights identical`); process.exit(bad ? 1 : 0);
}
let prev = {}; const picks = [], lastEntry = new Map(), t0 = Date.now(), perNight = [];
for (const [ni, t] of nights.entries()) {
  const out = runScan({ hist: truncatedHist(hist, t), types, sic, light: LIGHT, prev }); prev = out.state;
  const take = (set, list) => { for (const cand of list) {
    const s = hist.series.get(cand.sym); if (!s) continue; const e = t + 1, x = t + 1 + HOLD; if (!(s.c[e] > 0)) continue;
    let xc = s.c[x]; if (!(xc > 0)) { for (let k = x; k > e; k--) if (s.c[k] > 0) { xc = s.c[k]; break; } if (!(xc > 0)) continue; }
    const key = set + cand.sym; if (lastEntry.has(key) && e - lastEntry.get(key) < HOLD) continue; lastEntry.set(key, e);
    const cost = usCost(dv20(s, t)), net = xc / s.c[e] - 1 - cost, sr = spy[x] / spy[e] - 1;
    picks.push({ set, t, date: dates[t], sym: cand.sym, group: cand.group ?? 'none', net, spy: sr, ex: net - sr }); } };
  take('A', out.ready); take('B', [...out.ready, ...out.watch].sort((a, b) => b.composite - a.composite).slice(0, SCAN.top));
  perNight.push([out.ready.length, out.watch.length]);
  if (ni % 100 === 0) console.error(`night ${ni}/${nights.length} ${dates[t]} picks ${picks.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const bucket = (d) => d.slice(0, 4);
function stats(ps) {
  const ex = ps.map((p) => p.ex), by = new Map(); for (const p of ps) { const b = Math.floor((p.t - nights[0]) / 5); (by.get(b) ?? by.set(b, []).get(b)).push(p.ex); }
  // block bootstrap over 5-night blocks of entries (seed 20261016, 5,000 resamples)
  const bl = [...by.values()]; let s = 20261016 >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32), means = [];
  for (let r = 0; r < 5000 && bl.length; r++) { let sum = 0, n = 0; for (let i = 0; i < bl.length; i++) { const b = bl[Math.floor(rnd() * bl.length)]; for (const x of b) { sum += x; n++; } } means.push(sum / n); }
  means.sort((a, b) => a - b); const ci = means.length ? [means[Math.floor(0.05 * means.length)], means[Math.floor(0.95 * means.length)]] : [NaN, NaN];
  const groups = [...new Set(ps.map((p) => p.group))], gsum = groups.map((g) => [g, ps.filter((p) => p.group === g).reduce((a, p) => a + p.ex, 0)]).sort((a, b) => b[1] - a[1]), best = gsum[0]?.[0];
  const years = {}; for (const p of ps) (years[bucket(p.date)] ??= []).push(p.ex);
  return { n: ps.length, meanNet: mean(ps.map((p) => p.net)), meanExcess: mean(ex), ci90: ci, bestGroup: best, meanExAfterDropBestGroup: mean(ps.filter((p) => p.group !== best).map((p) => p.ex)), hit: ps.filter((p) => p.net > 0).length / (ps.length || 1),
    yearsPositive: Object.values(years).filter((v) => mean(v) > 0).length, years: Object.keys(years).length, byYear: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, { n: v.length, meanExcess: mean(v) }])) };
}
const A = picks.filter((p) => p.set === 'A'), B = picks.filter((p) => p.set === 'B'), sB = stats(B), sA = stats(A);
const crit = { meanExcessAboveZero: sB.meanExcess > 0, ciLowAboveZero: sB.ci90[0] > 0, aboveZeroAfterDroppingBestGroup: sB.meanExAfterDropBestGroup > 0, yearsPositiveAtLeast5of8: sB.yearsPositive >= 5 && sB.years === 8 };
const out = { run: new Date().toISOString().slice(0, 10), data: D.snapshot, label: 'SURVIVOR-BIASED UPWARD', nights: nights.length, light: LIGHT, judgedSet: 'B (top-10 list)', B: sB, A: sA, criteria: crit, pass: Object.values(crit).every(Boolean), nightsWithReady: perNight.filter((x) => x[0] > 0).length };
const recs = B.map((p) => ({ sym: p.sym, entry: p.date, group: p.group, regime: LIGHT + '-fixed', net: { 20: p.net }, mkt: { 20: p.spy } }));
const report = formatReport('C-119 test (b): frozen US-SCAN-1 top-10 list, US signals 2018-2025', recs, { market: 'us', survivorBiased: true, pricesAdjusted: true, sweepSize: 1, window: '2018-01 to 2025-09' }, { splitHorizon: 20, horizons: [20] });
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/c119-b-us.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C119-B-REPORT.md', report + '\n');
const f = (x) => (x * 100).toFixed(2) + '%';
console.log(JSON.stringify({ B: { n: sB.n, meanExcess: f(sB.meanExcess), ci90: sB.ci90.map(f), afterDrop: f(sB.meanExAfterDropBestGroup), bestGroup: sB.bestGroup, years: `${sB.yearsPositive} of ${sB.years}`, byYear: Object.fromEntries(Object.entries(sB.byYear).map(([y, o]) => [y, `${o.n}: ${f(o.meanExcess)}`])) }, A: { n: sA.n, meanExcess: f(sA.meanExcess) }, criteria: crit, pass: out.pass, nightsWithReady: out.nightsWithReady }, null, 1));
