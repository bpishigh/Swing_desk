// C-62 India run-up filter search, expanding walk-forward. Pre-registered in the Engine Rules change log (18 Oct 2026) before running.
// Base trade = top run-up third, buy close E+1, sell close E+21, 0.4% round trip. For each test year 2023..2026 the winner of 20 fixed filters is chosen on earlier events only.
// Usage: node --max-old-space-size=8000 scripts/earnings-filter-wf.mjs
// Retest (18 Oct 2026, registered before the new result): year rule scaled to 80% of the years with events (at least 5); the control must not show the same sign at |t|>2.
// Usage: node --max-old-space-size=8000 scripts/earnings-runup-test.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
import { buildHistories } from '../src/ingest/us-scan.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => x.endsWith('.json')).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const days = toDays(bhav), dates = days.map((d) => d.date), T = days.length;
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {};
const res = resolveHistory(bhav, actions, ov);
const allowed = new Set(); for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const H = buildHistories(days, res.splits, allowed);   // fully adjusted closes
const RD = R('data/india/results-dates.json'); const syms = Object.keys(RD.dates).filter((s) => H.series.has(s));
const c = (s, i) => { const v = H.series.get(s)?.c[i]; return v > 0 ? v : NaN; };
const ret = (s, a, b) => c(s, b) / c(s, a) - 1;
const first = (d) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
// equal-weight market over a window, among the universe, winsorised at +-50%
const mcache = new Map();
const mkt = (a, b) => { const k = a + ':' + b; if (mcache.has(k)) return mcache.get(k); let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } const v = n > 30 ? s / n : NaN; mcache.set(k, v); return v; };
const COST = 0.004, CS = (s) => H.series.get(s)?.c;
const mk = new Float64Array(T).fill(NaN); mk[0] = 100; for (let i = 1; i < T; i++) { const m = mkt(i - 1, i); mk[i] = mk[i - 1] * (1 + (m === m ? m : 0)); }
const smaOf = (a, i, n) => { let s = 0, k = 0; for (let j = i - n + 1; j <= i; j++) { const v = a[j]; if (v > 0) { s += v; k++; } } return k >= 0.8 * n ? s / k : NaN; };
const row = (s, i) => bhav[i].rows[s];
const avg = (f, a, b) => { let s = 0, k = 0; for (let j = a; j <= b; j++) { const v = f(j); if (v === v && v !== null && v >= 0) { s += v; k++; } } return k >= 10 ? s / k : NaN; };
const rows = [];
for (const s of syms) { const cl = CS(s); const ds = RD.dates[s]; for (let di = 0; di < ds.length; di++) { const d = ds[di];
  const E = first(d); if (E < 260 || E + 21 >= T || Math.abs(new Date(dates[E]) - new Date(d)) > 4 * 864e5) continue;
  const X = E + 1, px = cl[X], rx = row(s, X), re = row(s, E); if (!(px > 0) || !rx || !re) continue;
  const r = ret(s, X, E + 21), run = ret(s, E - 11, E - 1) - mkt(E - 11, E - 1), rea = ret(s, E - 1, X) - mkt(E - 1, X), m = mkt(X, E + 21);
  if (![r, run, rea, m].every((v) => v === v) || Math.abs(r) > 3) continue;
  let hi = 0; for (let j = X - 250; j <= X; j++) if (cl[j] > hi) hi = cl[j];
  const s200 = smaOf(cl, X, 200), s50 = smaOf(cl, X, 50), mom6 = ret(s, X - 125, X) - mkt(X - 125, X), m200 = smaOf(mk, X, 200);
  const vol = (i) => row(s, i)?.[6] ?? NaN, vAvgX = avg(vol, X - 20, X - 1), vAvgE = avg(vol, E - 20, E - 1);
  const vrX = vol(X) / vAvgX, vrE = vol(E) / vAvgE, dv = (i) => row(s, i)?.[7] ?? NaN, dAvg = avg(dv, X - 20, X - 1);
  const tv = avg((i) => (row(s, i) ? row(s, i)[6] * row(s, i)[5] : NaN), X - 20, X - 1), rg = avg((i) => (row(s, i) ? (row(s, i)[3] - row(s, i)[4]) / row(s, i)[5] : NaN), X - 20, X - 1);
  let prevRea = NaN; if (di > 0) { const E0 = first(ds[di - 1]); if (E0 >= 2 && Math.abs(new Date(dates[E0]) - new Date(ds[di - 1])) <= 4 * 864e5) prevRea = ret(s, E0 - 1, E0 + 1) - mkt(E0 - 1, E0 + 1); }
  rows.push({ y: dates[E].slice(0, 4), ym: dates[E].slice(0, 7), s, r, m, run,
    A1: rea >= 0, A2: rea >= 0.02, A3: rea >= 0.04, A4: rx[2] / rx[1] - 1 >= 0.015, A5: rx[3] > rx[4] && (rx[5] - rx[4]) / (rx[3] - rx[4]) >= 0.7, A6: vrX >= 2, A7: Math.max(vrX, vrE) >= 2,
    A8: dv(X) > dAvg, A9: px > s200, A10: px > s50, A11: px >= 0.9 * hi, A12: mom6 > 0, A13: mk[X] > m200, A14: px >= 100, A15: tv >= 5e7, A16: rg <= 0.03, A17: prevRea > 0, A18: run >= 0.06, A19: px <= 1.25 * s50 });
} }
const FL = Array.from({ length: 19 }, (_, i) => 'A' + (i + 1)), NAME = { A1: 'reaction>=0', A2: 'reaction>=2%', A3: 'reaction>=4%', A4: 'gap up>=1.5%', A5: 'close in top 30% of range', A6: 'entry-day volume>=2x', A7: 'results/entry volume>=2x', A8: 'delivery% above 20d avg', A9: 'above 200d', A10: 'above 50d', A11: 'within 10% of 52w high', A12: '6m return > market', A13: 'market proxy above 200d', A14: 'price>=100', A15: 'traded value>=5cr', A16: 'daily range<=3%', A17: 'prev reaction positive', A18: 'run-up>=6%', A19: 'not >25% above 50d' };
const g = {}; for (const e of rows) (g[e.ym] ||= []).push(e); const top = [];
for (const k in g) { const a = g[k]; if (a.length < 9) continue; [...a].sort((x, y) => x.run - y.run).forEach((e, i) => { if (i >= (2 * a.length) / 3) top.push(e); }); }
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), pct = (v) => (v * 100).toFixed(2) + '%';
const stat = (a) => { const net = a.map((e) => e.r - COST); return { n: a.length, mean: net.length ? mean(net) : NaN, win: net.length ? net.filter((v) => v > 0).length / net.length : NaN, mkt: mean(a.map((e) => e.m)) }; };
console.log(`top-third events ${top.length}; filters ${FL.length}`);
console.log('FULL SAMPLE (descriptive, not a test):'); console.log('base'.padEnd(28), JSON.stringify(Object.fromEntries(Object.entries(stat(top)).map(([k, v]) => [k, +v.toFixed(4)]))));
for (const f of FL) { const st = stat(top.filter((e) => e[f] === true)); console.log(NAME[f].padEnd(28), `n=${String(st.n).padStart(5)} net ${pct(st.mean).padStart(7)} win ${(st.win * 100).toFixed(0)}%`); }
const pooled = [], pooledBase = [], perYear = []; const out = { tried: FL.length, years: [] };
for (const Y of ['2023', '2024', '2025', '2026']) {
  const fit = top.filter((e) => e.y < Y), test = top.filter((e) => e.y === Y); const rs = {}; for (const f of FL) rs[f] = stat(fit.filter((e) => e[f] === true));
  const ok = FL.filter((f) => rs[f].n >= 200), rw = Object.fromEntries([...ok].sort((a, b) => rs[b].win - rs[a].win).map((f, i) => [f, i])), rm = Object.fromEntries([...ok].sort((a, b) => rs[b].mean - rs[a].mean).map((f, i) => [f, i]));
  const w = [...ok].sort((a, b) => rw[a] + rm[a] - rw[b] - rm[b])[0], tt = test.filter((e) => e[w] === true);
  pooled.push(...tt); pooledBase.push(...test); const sb = stat(test), sf = stat(tt); perYear.push({ Y, w, sf, sb });
  console.log(`${Y}: chosen on earlier years -> ${NAME[w]} (fit net ${pct(rs[w].mean)} win ${(rs[w].win * 100).toFixed(0)}%) | test ${Y}: filtered n=${sf.n} net ${pct(sf.mean)} win ${(sf.win * 100).toFixed(0)}% | base n=${sb.n} net ${pct(sb.mean)} win ${(sb.win * 100).toFixed(0)}%`);
  out.years.push({ Y, filter: w, name: NAME[w], filtered: sf, base: sb });
}
const P = stat(pooled), B = stat(pooledBase), posYears = perYear.filter((p) => p.sf.mean > 0).length;
console.log('\nPOOLED OUT-OF-SAMPLE 2023-2026:'); console.log('filtered'.padEnd(10), `n=${P.n} net ${pct(P.mean)} win ${(P.win * 100).toFixed(0)}% market ${pct(P.mkt)}`); console.log('base'.padEnd(10), `n=${B.n} net ${pct(B.mean)} win ${(B.win * 100).toFixed(0)}% market ${pct(B.mkt)}`);
const pass = P.n >= 300 && P.win - B.win >= 0.05 && P.mean - B.mean >= 0.015 && posYears >= 3;
console.log(`win-rate lift ${((P.win - B.win) * 100).toFixed(1)} pp (needs 5) | net lift ${pct(P.mean - B.mean)} (needs 1.5%) | positive test years ${posYears}/4 (needs 3) -> ${pass ? 'PASS' : 'FAIL'}`);
out.pooled = P; out.pooledBase = B; out.pass = pass; writeFileSync('data/replay/earnings-filter-wf-india.json', JSON.stringify(out, null, 1));
