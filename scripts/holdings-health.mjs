// Holdings health (Engine Rules C-101): for every fund with a stored portfolio, how much sits in stocks above their 200-session average and what those stocks returned in 6 months.
// Writes data/funds/holdhealth.json (latest, by fund code) and, once per month, appends a snapshot to data/funds/holdhealth-log.json (the record the C-101 test needs). Public data only.
// Usage: node scripts/holdings-health.mjs [--no-log]
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { stockTrend, fundHealth, rankHealth, HH } from '../src/pm/holdhealth.ts';
import { schemeBase } from '../src/pm/lookthrough.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const hold = J('data/funds/holdings.json', null), scores = J('data/funds/scores.json', null);
if (!hold || !scores) { console.error('holdings or scores missing'); process.exit(1); }
// stored closes: monthly history files, then the daily store (which wins)
const byDay = {};
if (existsSync('data/india/prices-hist')) for (const f of readdirSync('data/india/prices-hist').filter((x) => /^\d{4}-\d\d\.json$/.test(x)).sort().slice(-24)) { const c = J('data/india/prices-hist/' + f); c.dates.forEach((d, i) => { const o = (byDay[d] ??= {}); for (const [s, a] of Object.entries(c.px)) if (a[i] != null) o[s] = a[i]; }); }
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) { const o = (byDay[f.slice(0, 10)] ??= {}); for (const [s, r] of Object.entries(J('data/india/bhav/' + f).rows)) if (r[5] != null) o[s] = r[5]; }
const dates = Object.keys(byDay).sort(), priceDate = dates[dates.length - 1], span = dates.slice(-(HH.breakLookback + 5));
const trend = new Map(), syms = new Set(); for (const d of span) for (const s of Object.keys(byDay[d])) syms.add(s);
for (const s of syms) { const t = stockTrend(span, span.map((d) => byDay[d][s] ?? null), priceDate); if (t) trend.set(s, t); }
// name -> symbol, as the look-through does
const RENAMED = { zomato: 'eternal', 'larsen and toubro infotech': 'ltimindtree' };
const norm0 = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/\b(limited|ltd|the|corporation|corp|company|co)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(), norm = (s) => { const n = norm0(s); return RENAMED[n] ?? n; };
const names = J('data/names.json', { india: {} }).india, byName = new Map(); for (const [s, n] of Object.entries(names)) { if (!byName.has(norm(n))) byName.set(norm(n), s); if (!byName.has(norm(s))) byName.set(norm(s), s); }
const isinSym = new Map(); for (const r of J('data/india/corp-actions-history.json', [])) if (r.isin && r.symbol) isinSym.set(r.isin, r.symbol);
const resolve = (l) => (l.symbol && syms.has(l.symbol) ? l.symbol : l.isin && isinSym.get(l.isin)) || byName.get(norm(l.name)) || null;
const rows = [], skipped = { noPortfolio: 0, uncovered: 0 };
for (const f of scores.funds.filter((x) => x.g === 'mf' || x.g === 'idx')) {
  const p = hold.funds[schemeBase(f.name)]; if (!p || (p.code && p.code !== f.code)) { skipped.noPortfolio++; continue; }
  const h = fundHealth(p.lines, resolve, trend); if (!h) { skipped.uncovered++; continue; }
  rows.push({ code: f.code, cat: f.cat ?? f.category, portfolioAsOf: p.asOf, ...h });
}
const ranked = rankHealth(rows), round = (v, k) => Math.round(v * k) / k;
const funds = Object.fromEntries(ranked.map((r) => [r.code, { cat: r.cat, portfolioAsOf: r.portfolioAsOf, coverage: round(r.coverage, 1000), aboveShare: round(r.aboveShare, 1000), ret6m: round(r.ret6m, 1000), pct: r.pct, band: r.band }]));
const asOf = new Date().toISOString().slice(0, 10);
writeFileSync('data/funds/holdhealth.json', JSON.stringify({ asOf, priceDate, rule: 'C-101', params: HH, stocksReadable: trend.size, funds }) + '\n');
const log = J('data/funds/holdhealth-log.json', { rule: 'C-101', months: {} }), month = asOf.slice(0, 7);
if (!process.argv.includes('--no-log') && !log.months[month]) { log.months[month] = { takenOn: asOf, priceDate, portfolioAsOf: hold.asOf, funds }; writeFileSync('data/funds/holdhealth-log.json', JSON.stringify(log) + '\n'); console.log('snapshot recorded for', month); } else console.log('no snapshot written (already recorded or --no-log)');
const bands = {}; for (const r of ranked) bands[r.band ?? 'not ranked'] = (bands[r.band ?? 'not ranked'] ?? 0) + 1;
console.log(JSON.stringify({ priceDate, stocksReadable: trend.size, of: syms.size, covered: rows.length, ...skipped, bands }));
