// C-63 India scans x results replay. Pre-registered in the Engine Rules change log (18 Oct 2026) before running.
// Replays the frozen India scan (IND-SCAN-1, runScan) night by night with as-of data, light fixed to green; buys the next close, sells 20 sessions later, tiered cost; splits picks by where results fall.
// Look-aheads, disclosed: results dates are the realised ones (perfect calendar); the industry map is today's. No desk stops or targets (stage 1).
// Usage: node --max-old-space-size=8000 scripts/replay-ind-scan-results.mjs [--limit=N] [--from=2021-01-04]
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { runScan, buildHistories } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { tierCost } from '../src/backtest/ind-base.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LIMIT = +arg('limit', 0), FROM = arg('from', '2021-01-04'), HOLD = 20;
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const sel = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = { ...(existsSync('data/india/corp-action-overrides-hist.json') ? R('data/india/corp-action-overrides-hist.json') : {}), ...(existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {}) };
const res = resolveHistory(sel, actions, ov);
const industry = R('data/india/segments.json').industry ?? {}, allowed = new Set(Object.keys(industry)), types = new Map([...allowed].map((s) => [s, 'CS']));
const days = toDays(sel), dates = days.map((d) => d.date), T = days.length;
const FH = buildHistories(days, res.splits, allowed);       // fully adjusted: realised returns only
const RD = R('data/india/results-dates.json'), syms = [...allowed].filter((s) => FH.series.has(s));
const first = (d) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
const cc = (s, i) => { const v = FH.series.get(s)?.c[i]; return v > 0 ? v : NaN; }, ret = (s, a, b) => cc(s, b) / cc(s, a) - 1;
const mc = new Map(); const mkt = (a, b) => { const k = a + ':' + b; if (mc.has(k)) return mc.get(k); let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } const v = n > 30 ? s / n : NaN; mc.set(k, v); return v; };
const mk = new Float64Array(T).fill(NaN); mk[0] = 100; for (let i = 1; i < T; i++) { const m = mkt(i - 1, i); mk[i] = mk[i - 1] * (1 + (m === m ? m : 0)); }
const sma = (a, i, n) => { let s = 0, k = 0; for (let j = i - n + 1; j <= i; j++) if (a[j] > 0) { s += a[j]; k++; } return k >= 0.8 * n ? s / k : NaN; };
const EV = {}; for (const s of syms) EV[s] = (RD.dates[s] || []).map((d) => ({ E: first(d), d })).filter((e) => Math.abs(new Date(dates[e.E] ?? '2100-01-01') - new Date(e.d)) <= 4 * 864e5 || e.E >= T);
const dv20 = (s, t) => { const x = FH.series.get(s); let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (x.c[i] > 0 && x.v[i] === x.v[i]) { a += x.c[i] * x.v[i]; n++; } return n ? a / n : 0; };
const start = Math.max(first(FROM), 260); let nights = []; for (let t = start; t + HOLD + 1 < T; t++) nights.push(t); if (LIMIT) nights = nights.slice(0, LIMIT);
const picks = { A: [], B: [] }, lastEntry = { A: new Map(), B: new Map() }; let prev = {}; const t0 = Date.now();
for (const [ni, t] of nights.entries()) {
  const hist = asOfHistories(days, t, res, allowed), diagRows = [];
  const out = runScan({ hist, types, sic: new Map(), light: 'green', prev, settings: INDIA_SCAN, version: INDIA_SCAN_VERSION, groupOf: (s) => industry[s] ?? null, setupsByLight: INDIA_SETUPS, diagRows });
  prev = out.state;
  const pools = { A: new Set([...out.ready, ...out.watch].map((c) => c.sym)), B: new Set(diagRows.map((r) => r.sym)) };
  const e = t + 1, x = t + 1 + HOLD, regimeOn = mk[t] > sma(mk, t, 200);
  for (const P of ['A', 'B']) for (const sym of pools[P]) {
    if (lastEntry[P].has(sym) && e - lastEntry[P].get(sym) < HOLD) continue;
    const r = ret(sym, e, x); if (!(r === r) || Math.abs(r) > 3) continue; lastEntry[P].set(sym, e);
    const net = r - tierCost(dv20(sym, t)), m = mkt(e, x);
    const ev = EV[sym] || []; const nxt = ev.filter((q) => q.E >= t).sort((a, b) => a.E - b.E)[0], lst = ev.filter((q) => q.E < t).sort((a, b) => b.E - a.E)[0];
    const dNext = nxt ? nxt.E - t : null, dLast = lst ? t - lst.E : null; let lastRea = NaN; if (lst && lst.E + 1 <= t && lst.E >= 2) lastRea = ret(sym, lst.E - 1, lst.E + 1) - mkt(lst.E - 1, lst.E + 1);
    picks[P].push({ s: sym, d: dates[t], y: dates[t].slice(0, 4), ym: dates[t].slice(0, 7), net, ex: net - m, mkt: m, dNext, dLast, lastRea, regimeOn, setup: P === 'A' ? ([...out.ready, ...out.watch].find((c) => c.sym === sym)?.setup?.id ?? 'watch') : null });
  }
  if (ni % 100 === 0) console.error(`night ${ni}/${nights.length} ${dates[t]} A=${picks.A.length} B=${picks.B.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`nights ${nights.length}, pool A entries ${picks.A.length}, pool B entries ${picks.B.length}`);
// ---- analysis
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); }, pct = (v) => (v * 100).toFixed(2) + '%';
const S = (a) => ({ n: a.length, net: mean(a.map((p) => p.net)), win: a.filter((p) => p.net > 0).length / (a.length || 1), ex: mean(a.map((p) => p.ex)) });
const line = (n, a) => { const s = S(a); return `${n.padEnd(38)} n=${String(s.n).padStart(5)} net ${pct(s.net).padStart(7)} win ${(s.win * 100).toFixed(0)}% vs market ${pct(s.ex)}`; };
function compare(a, b) {      // a minus b: net mean, win rate, monthly-cluster t, years with same sign
  const ma = {}, mb = {}; for (const p of a) (ma[p.ym] ||= []).push(p.net); for (const p of b) (mb[p.ym] ||= []).push(p.net);
  const d = [], yr = {}; for (const k in ma) if (ma[k].length >= 3 && mb[k]?.length >= 3) { const x = mean(ma[k]) - mean(mb[k]); d.push(x); (yr[k.slice(0, 4)] ||= []).push(x); }
  const sa = S(a), sb = S(b), diff = sa.net - sb.net, t = d.length > 2 ? mean(d) / (sd(d) / Math.sqrt(d.length)) : NaN, years = Object.fromEntries(Object.entries(yr).map(([y, v]) => [y, +(mean(v) * 100).toFixed(2)]));
  return { nA: sa.n, nB: sb.n, netDiff: diff, winDiff: sa.win - sb.win, t, months: d.length, years };
}
const report = {};
for (const P of ['A', 'B']) {
  const all = picks[P]; console.log(`\n=== POOL ${P} (${P === 'A' ? 'Ready + Watch' : 'all qualified, non-extended'}) ===`); console.log(line('all picks', all));
  const near = all.filter((p) => p.dNext !== null && p.dNext >= 1 && p.dNext <= 10), rest = all.filter((p) => !(p.dNext !== null && p.dNext >= 1 && p.dNext <= 10));
  const buckets = [['results today (0)', (p) => p.dNext === 0], ['1-5 sessions away', (p) => p.dNext >= 1 && p.dNext <= 5], ['6-10 away', (p) => p.dNext >= 6 && p.dNext <= 10], ['11-20 away (inside hold)', (p) => p.dNext >= 11 && p.dNext <= 20], ['21+ away or none', (p) => p.dNext === null || p.dNext > 20]];
  for (const [n, f] of buckets) console.log(line(n, all.filter(f)));
  const h1 = compare(near, rest); console.log('H1 near(1-10) minus rest:', `net ${pct(h1.netDiff)} win ${(h1.winDiff * 100).toFixed(1)}pp t ${h1.t.toFixed(2)} months ${h1.months} years ${JSON.stringify(h1.years)}`);
  const post = all.filter((p) => p.dLast !== null && p.dLast >= 1 && p.dLast <= 20 && p.lastRea >= 0.02), other = all.filter((p) => !(p.dLast !== null && p.dLast >= 1 && p.dLast <= 20 && p.lastRea >= 0.02));
  console.log(line('after results, reaction>=+2% (1-20d)', post)); console.log(line('everything else', other));
  const h2 = compare(post, other); console.log('H2 post-results strong minus other:', `net ${pct(h2.netDiff)} win ${(h2.winDiff * 100).toFixed(1)}pp t ${h2.t.toFixed(2)} months ${h2.months} years ${JSON.stringify(h2.years)}`);
  console.log('by regime proxy:', ['on', 'off'].map((k) => line(k, all.filter((p) => (k === 'on') === p.regimeOn))).join(' | '));
  const yrs = [...new Set(all.map((p) => p.y))].sort(); console.log('by year:', yrs.map((y) => `${y}: n=${all.filter((p) => p.y === y).length} net ${pct(S(all.filter((p) => p.y === y)).net)}`).join(' | '));
  const sameYears = (h, want) => Object.values(h.years).filter((v) => Math.sign(v) === want).length;
  const v1 = h1.netDiff <= -0.015 && h1.winDiff <= -0.05 && h1.t < -2 && sameYears(h1, -1) >= 4, v2 = h2.netDiff >= 0.015 && h2.winDiff >= 0.05 && h2.t > 2 && sameYears(h2, 1) >= 4;
  console.log(`VERDICT pool ${P}: H1 (gate supported) ${v1 ? 'PASS' : 'FAIL'} | H2 (post-results strength) ${v2 ? 'PASS' : 'FAIL'}`);
  report[P] = { n: all.length, all: S(all), h1, h2, v1, v2, buckets: Object.fromEntries(buckets.map(([n, f]) => [n, S(all.filter(f))])) };
}
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/ind-scan-results.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), nights: nights.length, report }, null, 1));
writeFileSync('data/replay/ind-scan-results-picks.json', JSON.stringify(picks) + '\n');
