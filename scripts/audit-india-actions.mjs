// Audit of the India corporate-action history against the 2020-2025 price history (backtester data, step 2).
// For every one-day price break in every stock that ever traded (delisted included), is there an action on the list that explains it?
// Output: counts per year and per outcome, plus the unresolved list. Writes data/india/audit/actions-audit.json. Counts and symbols only.
// Usage: node --max-old-space-size=6000 scripts/audit-india-actions.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolveBreaks } from '../src/ingest/corp-actions.ts';

const days = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) days.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => x.endsWith('.json')).sort()) days.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
days.sort((a, b) => (a.date < b.date ? -1 : 1));
const actions = [...JSON.parse(readFileSync('data/india/corp-actions-history.json')), ...(existsSync('data/india/corp-actions.json') ? JSON.parse(readFileSync('data/india/corp-actions.json')) : [])];
const overrides = { ...(existsSync('data/india/corp-action-overrides-hist.json') ? JSON.parse(readFileSync('data/india/corp-action-overrides-hist.json')) : {}), ...(existsSync('data/india/corp-action-overrides.json') ? JSON.parse(readFileSync('data/india/corp-action-overrides.json')) : {}) };   // hand overrides win over rule-derived ones
const idx = existsSync('data/india/idx_closes.json') ? JSON.parse(readFileSync('data/india/idx_closes.json')).closes['Nifty 500'] || {} : {};
const md = Object.keys(idx).sort(); const mr = (d) => { const i = md.indexOf(d); return i > 0 ? idx[d] / idx[md[i - 1]] - 1 : null; };
const res = resolveBreaks(days, actions, overrides, () => true, mr, true);
const yr = (d) => d.slice(0, 4);
const tally = (arr) => arr.reduce((o, x) => ((o[yr(x.date)] = (o[yr(x.date)] || 0) + 1), o), {});
const live = new Set(Object.keys(days.at(-1).rows));
const un = res.unresolved.map((u) => ({ ...u, delisted: !live.has(u.symbol) }));
const out = { days: days.length, first: days[0].date, last: days.at(-1).date, actions: actions.length, resolved: tally(res.resolved), real: tally(res.real), unresolved: tally(res.unresolved), totals: { resolved: res.resolved.length, real: res.real.length, unresolved: un.length, unresolvedDelisted: un.filter((u) => u.delisted).length },
  unresolvedByReason: un.reduce((o, u) => ((o[u.reason] = (o[u.reason] || 0) + 1), o), {}), unresolvedList: un };
mkdirSync('data/india/audit', { recursive: true }); writeFileSync('data/india/audit/actions-audit.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ ...out, unresolvedList: undefined }, null, 1));
