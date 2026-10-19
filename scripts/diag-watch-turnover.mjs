// Diagnostic (19 Oct 2026, owner question: why is the watchlist so constant across days?). Replays the frozen India scan (IND-SCAN-1) over the last N sessions
// and reports night-to-night turnover of the shown list (ready + watch, capped as on the site) and of the underlying qualified set. Output only; no rule change.
// Usage: node --max-old-space-size=6000 scripts/diag-watch-turnover.mjs [--n=60] [--light=red]
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { runScan, buildHistories } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
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

const N = +arg('n', 60), LIGHT = arg('light', 'red');
const first0 = T - N - 1, warm = Math.max(260, first0 - 30);
let prev = {}; const shown = [], qual = [], dts = [];
for (let t = warm; t < T; t++) {
  const hist = asOfHistories(days, t, res, allowed);
  const out = runScan({ hist, types, sic: new Map(), light: LIGHT, prev, settings: INDIA_SCAN, version: INDIA_SCAN_VERSION, groupOf: (s) => industry[s] ?? null, setupsByLight: INDIA_SETUPS, diagRows: [] });
  prev = out.state;
  if (t >= first0) { shown.push(new Set([...out.ready, ...out.watch].map((c) => c.sym))); qual.push(new Set(Object.entries(out.state).filter(([, v]) => v.in).map(([k]) => k))); dts.push(dates[t]); }
}
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return { kept: i, of: a.size, added: b.size - i }; };
const rows = []; for (let k = 1; k < shown.length; k++) rows.push({ d: dts[k], shown: shown[k].size, ...Object.fromEntries(Object.entries(jac(shown[k - 1], shown[k])).map(([a, b]) => ['s_' + a, b])), q: qual[k].size, q_added: jac(qual[k - 1], qual[k]).added, q_dropped: qual[k - 1].size - jac(qual[k - 1], qual[k]).kept });
console.log(dts[0], '->', dts.at(-1), 'light', LIGHT);
for (const r of rows.slice(-25)) console.log(JSON.stringify(r));
const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(2);
console.log('avg shown size', avg((r) => r.shown), '| avg names added a night', avg((r) => r.s_added), '| avg names kept of previous', avg((r) => r.s_kept), 'of', avg((r) => r.s_of));
console.log('qualified set: avg size', avg((r) => r.q), '| added a night', avg((r) => r.q_added), '| dropped a night', avg((r) => r.q_dropped));
const days0 = rows.filter((r) => r.s_added === 0).length; console.log('nights with an unchanged shown list:', days0, 'of', rows.length);
const everShown = new Set(shown.flatMap((s) => [...s])); console.log('distinct names ever shown in the window:', everShown.size);
