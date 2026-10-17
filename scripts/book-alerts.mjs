// Nightly alerts for open trades and kept Legacy holdings (moved from the Claude Desk, 17 Oct 2026). Usage: node --max-old-space-size=6000 scripts/book-alerts.mjs india|us [--dry]
// Reads portfolio/book/positions.json; computes from the repo's own price stores; writes portfolio/book/latest.json, updates maxClose and lastEval on open trades, and sends ONE Telegram message
// per market per date when something fires (state in portfolio/book/state.json). Changes no rule.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { bookAlerts, regimeDropped } from '../src/ingest/book-alerts.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { loadDays } from './us-hist-lib.mjs';

const market = process.argv[2], DRY = process.argv.includes('--dry');
if (!['india', 'us'].includes(market)) { console.error('usage: book-alerts.mjs india|us'); process.exit(1); }
const rd = (p, d = {}) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const positions = rd('portfolio/book/positions.json', { trades: [], legacy: [] });
const watch = new Set([...positions.trades.filter((t) => t.market === market && t.status === 'open').map((t) => t.symbol), ...positions.legacy.filter((l) => l.market === market && l.status === 'pass').map((l) => l.symbol)]);
const state = rd('portfolio/book/state.json', { alerted: {}, regime: {} });
const latest = rd('portfolio/book/latest.json', {});
const cur = rd(`data/${market}/regime.json`, {}).latest?.name ?? null;
const calJson = rd('data/calendar/markets-2026.json');
const cal = makeCalendar([...(calJson[market]?.holidays ?? []), ...(calJson[market]?.priorHolidays ?? [])]);

let dates = [], series = () => undefined;
if (watch.size) {
  if (market === 'us') {
    const days = loadDays().map((d) => ({ date: d.date, rows: d.rows.filter((r) => watch.has(r[0])) }));
    const h = buildHistories(days, [], watch); dates = h.dates; series = (s) => h.series.get(s);
  } else {
    const bhav = [];
    for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
    for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
    bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
    const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
    const actions = [...rd('data/india/corp-actions-history.json', []), ...rd('data/india/corp-actions.json', [])];
    const ov = { ...rd('data/india/corp-action-overrides-hist.json'), ...rd('data/india/corp-action-overrides.json') };
    const res = resolveHistory(uniq, actions, ov), days = toDays(uniq);
    const h = asOfHistories(days, days.length - 1, res, watch); dates = h.dates; series = (s) => h.series.get(s);
  }
} else dates = [rd(`data/${market}/regime.json`, {}).latest?.date ?? new Date().toISOString().slice(0, 10)];
const date = dates[dates.length - 1];
const prevRegime = state.regime?.[market]?.name && state.regime[market].date !== date ? state.regime[market].name : (state.regime?.[market]?.prev ?? null);
const r = bookAlerts({ market, positions, dates, series, dropped: regimeDropped(prevRegime, cur), cal });
console.log(JSON.stringify({ market, date, trades: r.trades, legacyKept: r.legacyKept, lines: r.lines, missing: r.missing }));
if (DRY) process.exit(0);

for (const u of r.updates) { const t = positions.trades.find((x) => x.market === market && x.symbol === u.symbol && x.status === 'open'); if (t) { t.maxClose = u.maxClose; t.lastEval = u.lastEval; } }
if (r.updates.length) writeFileSync('portfolio/book/positions.json', JSON.stringify(positions, null, 1) + '\n');
latest[market] = { date, trades: r.trades, legacyKept: r.legacyKept, lines: r.lines, missing: r.missing };
writeFileSync('portfolio/book/latest.json', JSON.stringify(latest, null, 1) + '\n');
if (cur && state.regime?.[market]?.date !== date) state.regime[market] = { date, name: cur, prev: state.regime?.[market]?.name ?? null };
let failed = false;
const msg = [...r.lines, ...r.missing.map((m) => 'Data missing: ' + m)];
if (msg.length && state.alerted?.[market] !== date) {
  try { execFileSync('node', ['scripts/alert.mjs', `${market === 'us' ? 'US' : 'India'} positions ${date}:\n` + msg.join('\n')], { stdio: 'inherit' }); state.alerted = { ...state.alerted, [market]: date }; }
  catch { console.error('alert could not be sent; the next run will try again'); failed = true; }
}
writeFileSync('portfolio/book/state.json', JSON.stringify(state, null, 1) + '\n');
if (failed) process.exit(1);
