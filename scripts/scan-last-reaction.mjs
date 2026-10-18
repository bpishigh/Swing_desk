// Last results reaction for the India scan's Ready and Watch names (output only; changes no scan result). Writes data/india/scan/last-reaction.json.
// Reaction = close the day before the results date to the close the day after, raw and relative to the equal-weight market of the scan universe. Needs data/india/results-dates.json.
// Usage: node --max-old-space-size=4000 scripts/scan-last-reaction.mjs india
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
import { buildHistories } from '../src/ingest/us-scan.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
if (process.argv[2] !== 'india') { console.error('usage: scan-last-reaction.mjs india'); process.exit(1); }
const scan = existsSync('data/india/scan/latest.json') ? R('data/india/scan/latest.json') : null; if (!scan || !existsSync('data/india/results-dates.json')) { console.log('no scan or results dates'); process.exit(0); }
const names = [...new Set([...scan.ready, ...scan.watch].map((c) => c.sym))], RD = R('data/india/results-dates.json');
const bhav = readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort().map((f) => R('data/india/bhav/' + f)).filter((d) => d.date <= scan.asOf);
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = { ...(existsSync('data/india/corp-action-overrides-hist.json') ? R('data/india/corp-action-overrides-hist.json') : {}), ...(existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {}) };
const res = resolveHistory(bhav, actions, ov), days = toDays(bhav), dates = days.map((d) => d.date), T = days.length;
const allowed = new Set(Object.keys(R('data/india/segments.json').industry ?? {})), H = buildHistories(days, res.splits, allowed), syms = [...allowed].filter((s) => H.series.has(s));
const c = (s, i) => { const v = H.series.get(s)?.c[i]; return v > 0 ? v : NaN; }, ret = (s, a, b) => c(s, b) / c(s, a) - 1;
const first = (d) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
const mkt = (a, b) => { let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } return n > 30 ? s / n : NaN; };
const rows = {};
for (const s of names) {
  let best = null; for (const d of RD.dates[s] || []) { const E = first(d); if (E >= 2 && E + 1 < T && Math.abs(new Date(dates[E]) - new Date(d)) <= 4 * 864e5 && (!best || E > best.E)) best = { E, d }; }
  if (!best) continue; const move = ret(s, best.E - 1, best.E + 1), ex = move - mkt(best.E - 1, best.E + 1); if (move === move && ex === ex) rows[s] = { date: best.d, move: +move.toFixed(4), excess: +ex.toFixed(4) };
}
console.log(JSON.stringify({ names: names.length, found: Object.keys(rows).length }));
writeFileSync('data/india/scan/last-reaction.json', JSON.stringify({ asOf: scan.asOf, rows }, null, 1) + '\n');
