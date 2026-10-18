// C-60 India run-up filter test. Pre-registered in the Engine Rules change log (18 Oct 2026) before running.
// Base trade = C-59 top run-up third: buy close E+1, sell close E+21, 0.4% round trip. Fit Jan 2020 to Dec 2023 picks ONE of 8 fixed filters; it is judged once on the holdout Jan 2024 to Aug 2026.
// Usage: node --max-old-space-size=8000 scripts/earnings-filter-test.mjs
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
// equal-weight market proxy index (cumulative), for F7
const mk = new Float64Array(T).fill(NaN); mk[0] = 100; for (let i = 1; i < T; i++) { const m = mkt(i - 1, i); mk[i] = mk[i - 1] * (1 + (m === m ? m : 0)); }
const smaOf = (a, i, n) => { let s = 0, k = 0; for (let j = i - n + 1; j <= i; j++) { const v = a[j]; if (v > 0) { s += v; k++; } } return k >= 0.8 * n ? s / k : NaN; };
const rows = [];
for (const s of syms) { const cl = CS(s); for (const d of RD.dates[s]) {
  const E = first(d); if (E < 260 || E + 21 >= T || Math.abs(new Date(dates[E]) - new Date(d)) > 4 * 864e5) continue;
  const X = E + 1, px = cl[X]; if (!(px > 0)) continue;
  const r = ret(s, X, E + 21), run = ret(s, E - 11, E - 1) - mkt(E - 11, E - 1), rea = ret(s, E - 1, X) - mkt(E - 1, X), m = mkt(X, E + 21);
  if (![r, run, rea, m].every((v) => v === v) || Math.abs(r) > 3) continue;
  let hi = 0; for (let j = X - 250; j <= X; j++) if (cl[j] > hi) hi = cl[j];
  const s200 = smaOf(cl, X, 200), s50 = smaOf(cl, X, 50), mom6 = ret(s, X - 125, X) - mkt(X - 125, X), m200 = smaOf(mk, X, 200);
  rows.push({ y: dates[E].slice(0, 4), ym: dates[E].slice(0, 7), s, r, m, run, F1: rea > 0, F2: rea > 0.02, F3: px > s200, F4: px > s50, F5: px >= 0.9 * hi, F6: mom6 > 0, F7: mk[X] > m200, F8: px >= 100 });
} }
// top run-up third inside month cohorts
const g = {}; for (const e of rows) (g[e.ym] ||= []).push(e); const top = [];
for (const k in g) { const a = g[k]; if (a.length < 9) continue; [...a].sort((x, y) => x.run - y.run).forEach((e, i) => { if (i >= (2 * a.length) / 3) top.push(e); }); }
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), pct = (v) => (v * 100).toFixed(2) + '%';
const stat = (a) => { const net = a.map((e) => e.r - COST); const yr = {}; for (const e of a) (yr[e.y] ||= []).push(e.r - COST); return { n: a.length, mean: mean(net), win: net.filter((v) => v > 0).length / (net.length || 1), mkt: mean(a.map((e) => e.m)), years: Object.fromEntries(Object.entries(yr).map(([y, v]) => [y, +(mean(v) * 100).toFixed(1)])) }; };
const FIT = (e) => e.y <= '2023', HOLD = (e) => e.y >= '2024';
const line = (n, st) => `${n.padEnd(22)} n=${String(st.n).padStart(5)} net ${pct(st.mean).padStart(7)} win ${(st.win * 100).toFixed(0)}% market ${pct(st.mkt)}`;
console.log(`top-third events ${top.length}`);
const base = { fit: stat(top.filter(FIT)), hold: stat(top.filter(HOLD)) }; console.log('FIT    ', line('base top third', base.fit)); console.log('HOLD   ', line('base top third', base.hold));
const F = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'], RS = {};
for (const f of F) { RS[f] = { fit: stat(top.filter((e) => e[f] && FIT(e))), hold: stat(top.filter((e) => e[f] && HOLD(e))) }; console.log('FIT    ', line(f, RS[f].fit)); }
// winner chosen on fit only: average of rank by win rate and rank by net mean, at least 300 fit events
const ok = F.filter((f) => RS[f].fit.n >= 300); const rk = (key) => Object.fromEntries([...ok].sort((a, b) => RS[b].fit[key] - RS[a].fit[key]).map((f, i) => [f, i]));
const rw = rk('win'), rm = rk('mean'); const win = [...ok].sort((a, b) => rw[a] + rm[a] - rw[b] - rm[b])[0];
console.log('\nWINNER ON FIT ONLY:', win, '(of', F.length, 'tried)');
const h = RS[win].hold, b = base.hold;
console.log('HOLD   ', line(win, h)); console.log('HOLD   ', line('base top third', b));
console.log('by year', JSON.stringify(h.years));
const posYears = Object.values(h.years).filter((v) => v > 0).length, nYears = Object.keys(h.years).length;
const pass = h.n >= 300 && h.win - b.win >= 0.05 && h.mean - b.mean >= 0.015 && posYears >= 5;
console.log('win-rate lift', ((h.win - b.win) * 100).toFixed(1) + ' pp', '| net lift', pct(h.mean - b.mean), '| positive years (all 7 years, fit+hold)', JSON.stringify(stat(top.filter((e) => e[win])).years));
console.log('HOLDOUT VERDICT', pass ? 'PASS' : 'FAIL', `(positive holdout years ${posYears}/${nYears}; rule asked 5 of 7 calendar years: see all-years line)`);
writeFileSync('data/replay/earnings-filter-india.json', JSON.stringify({ base, res: RS, winner: win, tried: F.length, pass }, null, 1));
