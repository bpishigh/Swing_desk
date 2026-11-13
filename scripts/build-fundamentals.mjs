// Batch A, A0: nightly company-figures table (claude/batch-a-fundamentals-rules-draft.md). Paper only, no orders, no alerts.
// For each name in the universe (the 500 highest by 20-session median traded value, decision D1) builds the as-of figures from the stored filings and writes data/india/fundamentals/latest.json.
// Idempotent; a failed run keeps the last good file. Missing is null, never 0.
// Usage: node --max-old-space-size=6000 scripts/build-fundamentals.mjs [--asof=YYYY-MM-DD] [--out=path] [--universe=500]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE } from '../src/backtest/ind-base.ts';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures, flagsOf } from '../src/engine/fundamentals-asof.ts';
import { grahamList } from '../src/engine/batch-a.ts';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const ASOF = arg('asof', ''), OUT = arg('out', 'data/india/fundamentals/latest.json'), UNIVERSE = Number(arg('universe', '500'));
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
BASE.universe = UNIVERSE;   // D1: fundamentals books use the top 500, not the first-wave top 200 (this process only)

const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date), sel0 = ASOF ? uniq.filter((d) => d.date <= ASOF) : uniq;
const actions = [...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(sel0, actions, ov), days = toDays(sel0), t = days.length - 1, D = days[t].date;
const industry = R('data/india/segments.json', {}).industry ?? {}, allowed = new Set(Object.keys(industry));
for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const hist = asOfHistories(days, t, res, allowed);
const list = eligible(hist, t);

const ents = R('data/india/entities.json').entities, bySym = new Map();
for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push([u, e]); bySym.set(u.symbol, a); }
const entityOf = (sym) => { const a = bySym.get(sym); if (!a) return null; return (a.find(([u]) => (u.from == null || u.from <= D) && (u.to == null || u.to >= D)) || a[a.length - 1])[1]; };
const splitsOf = new Map(); for (const [sym, date, factor] of res.splits) { const a = splitsOf.get(sym) || []; a.push({ date, factor }); splitsOf.set(sym, a); }

const rows = {}, cov = { eligible: list.length, noEntity: 0, noFilings: 0, ttm: 0, growth: 0, cagr3: 0, balanceSheet: 0, earningsYield: 0, fiscalEnd: 0, financial: 0, factsWithoutTime: 0 };
for (const p of list) {
  const e = entityOf(p.sym); if (!e) { cov.noEntity++; continue; }
  const path = `data/india/filings/${e.id}.json.gz`; if (!existsSync(path)) { cov.noFilings++; continue; }
  const store = JSON.parse(gunzipSync(readFileSync(path)));
  const noTime = store.results.filter((y) => !y.asOf).length; cov.factsWithoutTime += noTime;   // a filing with no broadcast time cannot be placed in time and is not used
  const facts = store.results.filter((y) => y.asOf).map((y) => ({ entity: e.id, period: y.period, basis: y.basis, asOf: y.asOf, revision: y.revision ?? 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra }));
  const view = asOfResults(facts, e.id, D, { limit: 40, events: e.events });
  const f = computeFeatures(view, hist.series.get(p.sym)?.c[t] ?? null, splitsOf.get(p.sym) ?? []);
  if (f.ttm.pat != null) cov.ttm++; if (f.growth.revenue != null || f.growth.pbtPre != null) cov.growth++; if (f.growth.revenueCagr3 != null) cov.cagr3++; if (f.bs) cov.balanceSheet++; if (f.earningsYield != null) cov.earningsYield++; if (f.fiscalYears.length) cov.fiscalEnd++; if (f.financial) cov.financial++;
  rows[p.sym] = { entity: e.id, tradedValue: Math.round(p.value), ...f, flags: flagsOf(f) };   // A7: information only, no book reads it
}
// A4: Graham-lite passers, a list for information (no book). A7 pledge flag is not available from these filings, so it is absent, not false.
const graham = grahamList({ el: list.map((p) => ({ sym: p.sym, value: p.value })), fund: rows, series: new Map(), t, dates: [], held: new Set(), st: {} });
const flagCount = { dilution: 0, exceptional: 0, profitWithoutSales: 0 }; for (const r of Object.values(rows)) for (const k of Object.keys(flagCount)) if (r.flags[k]) flagCount[k]++;
cov.graham = graham.length; cov.flags = flagCount;
const out = { version: 'FUND-1', asOf: D, graham, flagsNote: 'pledge flag unavailable (no shareholding data in the filings)', source: 'data/india/filings (NSE results XBRL), prices from the daily files', universe: UNIVERSE, coverage: cov, rows };
mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(D, JSON.stringify(cov));
