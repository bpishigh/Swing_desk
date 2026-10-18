// C-59 India pre-earnings run-up test. Pre-registered in the Engine Rules change log (18 Oct 2026) before any result was read.
// Events: past results dates (data/india/results-dates.json). Run-up = close(E-11)->close(E-1) minus equal-weight market (same symbols) over the same window.
// Reaction = close(E-1)->close(E+1). Drift = close(E+1)->close(E+21). Terciles of run-up are formed inside each calendar-month cohort (removes market-wide timing).
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
const ev = [];
for (const s of syms) for (const d of RD.dates[s]) {
  const E = first(d); if (E < 15 || E + 21 >= T || dates[E] > d && E === 0) continue;
  if (Math.abs(new Date(dates[E]) - new Date(d)) > 4 * 864e5) continue;   // date not near a session
  const run = ret(s, E - 11, E - 1) - mkt(E - 11, E - 1), rea = ret(s, E - 1, E + 1) - mkt(E - 1, E + 1), dr = ret(s, E + 1, E + 21) - mkt(E + 1, E + 21);
  if (![run, rea, dr].every((v) => v === v && Math.abs(v) < 3)) continue;
  ev.push({ s, d: dates[E], ym: dates[E].slice(0, 7), y: dates[E].slice(0, 4), run, rea, dr });
}
console.log(`symbols ${syms.length}, events used ${ev.length}, ${ev.map((e) => e.d).sort()[0]}..${ev.map((e) => e.d).sort().at(-1)}`);
// terciles inside month cohorts
const by = {}; for (const e of ev) (by[e.ym] ||= []).push(e);
const tev = []; for (const k in by) { const g = by[k]; if (g.length < 9) continue; const s = [...g].sort((a, b) => a.run - b.run); s.forEach((e, i) => { e.t = i < g.length / 3 ? 'low' : i >= (2 * g.length) / 3 ? 'high' : 'mid'; tev.push(e); }); }
console.log(`events in cohorts of 9+: ${tev.length}`);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const tstat = (a) => (a.length > 2 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : NaN);
const pct = (v) => (v * 100).toFixed(2) + '%';
// cohort-level (month) difference high - low, clustered t across months
function diffTest(field, filt = () => true) {
  const per = {}; for (const e of tev) { if (!filt(e)) continue; const k = e.ym; (per[k] ||= { high: [], low: [] }); if (e.t !== 'mid') per[k][e.t].push(e[field]); }
  const d = [], yr = {}; for (const k in per) { const p = per[k]; if (p.high.length < 3 || p.low.length < 3) continue; const x = mean(p.high) - mean(p.low); d.push(x); (yr[k.slice(0, 4)] ||= []).push(x); }
  return { months: d.length, diff: mean(d), t: tstat(d), years: Object.fromEntries(Object.entries(yr).map(([y, a]) => [y, +(mean(a) * 100).toFixed(2)])) };
}
const out = { generated: new Date().toISOString().slice(0, 10), events: ev.length, cohortEvents: tev.length, byTercile: {}, tests: {} };
for (const t of ['low', 'mid', 'high']) { const g = tev.filter((e) => e.t === t); out.byTercile[t] = { n: g.length, runup: mean(g.map((e) => e.run)), reaction: mean(g.map((e) => e.rea)), drift: mean(g.map((e) => e.dr)), reactionT: tstat(g.map((e) => e.rea)), driftT: tstat(g.map((e) => e.dr)), reactionHit: g.filter((e) => e.rea > 0).length / g.length, driftHit: g.filter((e) => e.dr > 0).length / g.length }; console.log(t.padEnd(5), `n=${g.length} runup ${pct(mean(g.map((e) => e.run)))} | reaction ${pct(mean(g.map((e) => e.rea)))} (t ${tstat(g.map((e) => e.rea)).toFixed(1)}, up ${(100 * g.filter((e) => e.rea > 0).length / g.length).toFixed(0)}%) | drift ${pct(mean(g.map((e) => e.dr)))} (t ${tstat(g.map((e) => e.dr)).toFixed(1)}, up ${(100 * g.filter((e) => e.dr > 0).length / g.length).toFixed(0)}%)`); }
const show = (name, r) => { out.tests[name] = r; console.log(name.padEnd(34), `diff ${pct(r.diff)} t ${r.t.toFixed(2)} months ${r.months} years ${JSON.stringify(r.years)}`); };
show('H1 reaction high-low', diffTest('rea'));
show('H2 drift high-low (all)', diffTest('dr'));
show('H2 drift high-low | reaction>0', diffTest('dr', (e) => e.rea > 0));
show('H2 drift high-low | reaction<0', diffTest('dr', (e) => e.rea <= 0));
show('run-up itself high-low', diffTest('run'));
// plain post-earnings drift by reaction sign, for context
for (const [n, f] of [['reaction>0', (e) => e.rea > 0], ['reaction<=0', (e) => e.rea <= 0]]) { const g = tev.filter(f); console.log(n.padEnd(12), `n=${g.length} drift ${pct(mean(g.map((e) => e.dr)))} t ${tstat(g.map((e) => e.dr)).toFixed(1)}`); }
// verdict against the pre-registered rule: |t|>2, same sign in >=4 of 5 years, effect >=1pp
const verdict = (r) => { const ys = Object.values(r.years), s = Math.sign(r.diff), same = ys.filter((v) => Math.sign(v) === s).length; return { pass: Math.abs(r.t) > 2 && same >= Math.min(4, ys.length) && Math.abs(r.diff) >= 0.01, sameSignYears: `${same}/${ys.length}` }; };
for (const k in out.tests) { out.tests[k].verdict = verdict(out.tests[k]); console.log('VERDICT', k, JSON.stringify(out.tests[k].verdict)); }
// POST-HOC control (added after the first result, labelled as such): the same stocks 30 sessions after each results date (mid-quarter, no results nearby).
// If the same run-up -> drift gap shows up here, it is ordinary short-term momentum and not an earnings effect.
{
  const ctl = []; for (const e of ev) { const E = first(e.d) + 30; if (E + 21 >= T) continue; const run = ret(e.s, E - 11, E - 1) - mkt(E - 11, E - 1), dr = ret(e.s, E + 1, E + 21) - mkt(E + 1, E + 21); if ([run, dr].every((v) => v === v && Math.abs(v) < 3)) ctl.push({ ym: dates[E].slice(0, 7), run, dr }); }
  const cb = {}; for (const e of ctl) (cb[e.ym] ||= []).push(e); const d = [], yr = {};
  for (const k in cb) { const g = cb[k]; if (g.length < 9) continue; const s = [...g].sort((a, b) => a.run - b.run), n = g.length, lo = s.slice(0, Math.floor(n / 3)), hi = s.slice(Math.ceil((2 * n) / 3)); const x = mean(hi.map((e) => e.dr)) - mean(lo.map((e) => e.dr)); d.push(x); (yr[k.slice(0, 4)] ||= []).push(x); }
  out.control = { events: ctl.length, months: d.length, diff: mean(d), t: tstat(d), years: Object.fromEntries(Object.entries(yr).map(([y, a]) => [y, +(mean(a) * 100).toFixed(2)])) };
  console.log('CONTROL (non-earnings dates) drift high-low', pct(out.control.diff), 't', out.control.t.toFixed(2), 'months', d.length, JSON.stringify(out.control.years));
}
writeFileSync('data/replay/earnings-runup-india.json', JSON.stringify(out, null, 1));
