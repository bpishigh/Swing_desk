// Batch A, A0, US version (docs/BATCH_A_RULES.md; US is a confirmation market, C-179): nightly company-figures table for the 500 most traded US common stocks and ADRs, from data/us/facts (SEC EDGAR, src/ingest/edgar-facts.ts).
// Same figures and same code as the India table (src/engine/fundamentals-asof.ts). Writes data/us/fundamentals/latest.json {version:'FUND-US-1', asOf, universe, coverage, graham, rows{TICKER:{...Features, flags}}}.
// US bars are split-adjusted to today while the share count on a filing cover is not: a name with a split-like one-day move since its latest filing gets no market cap or earnings yield (reason recorded), as the books block such names anyway (C-179 item 9c).
// Usage: node --max-old-space-size=6000 scripts/build-fundamentals-us.mjs [--asof=YYYY-MM-DD] [--out=path]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { eligibleUs } from '../src/engine/momentum-sleeve.ts';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures, flagsOf } from '../src/engine/fundamentals-asof.ts';
import { grahamList } from '../src/engine/batch-a.ts';
import { splitLike, dayMove } from '../src/engine/gap-events.ts';
import { loadDays } from './us-hist-lib.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const ASOF = arg('asof', ''), OUT = arg('out', 'data/us/fundamentals/latest.json');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const tk = R('data/us/' + readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop());
const allowed = new Set(tk.rows.filter(([, ty]) => ty === 'CS' || ty === 'ADRC').map(([sym]) => sym));
const days = loadDays(ASOF || undefined).map((d) => ({ date: d.date, rows: d.rows.filter((r) => allowed.has(r[0])) })), dates = days.map((d) => d.date), t = days.length - 1, D = dates[t];
const series = buildHistories(days, [], allowed).series;
const list = eligibleUs(series, t).slice(0, 500).map((p) => ({ sym: p.sym, value: p.value }));
const cov = { eligible: list.length, noFacts: 0, ttm: 0, growth: 0, cagr3: 0, balanceSheet: 0, earningsYield: 0, fiscalEnd: 0, financial: 0, splitSinceFiling: 0, sue: 0 };
const rows = {};
for (const p of list) {
  const f = `data/us/facts/${p.sym.replace(/[^A-Za-z0-9.-]/g, '_')}.json.gz`; if (!existsSync(f)) { cov.noFacts++; continue; }
  const store = JSON.parse(gunzipSync(readFileSync(f)));
  const facts = store.results.map((y) => ({ entity: p.sym, period: y.period, basis: y.basis, asOf: y.asOf, revision: 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra }));
  const view = asOfResults(facts, p.sym, D, { limit: 40 }), s = series.get(p.sym), close = s?.c[t] ?? null;
  // a split-like move since the latest filing makes the cover share count and today's adjusted close disagree
  const latest = view.quarters[0]?.asOf.slice(0, 10) ?? null; let splitSince = false;
  if (latest && s) for (let i = t; i > 0 && dates[i] > latest; i--) { const m = dayMove(s.c, i); if (m && splitLike(m.ratio)) { splitSince = true; break; } }
  const f1 = computeFeatures(view, splitSince ? null : close, [], { sueShareRule: process.env.SUE_SHARE_RULE === 'both' ? 'both' : 'increase' });   // US A1 skips a name only when its share count rose more than 2% (new issuance); a fall (buyback) does not skip it. 'both' is the India rule, kept for measurement.
  if (splitSince) { cov.splitSinceFiling++; f1.eyNullReason = 'split since filing'; }
  if (f1.ttm.pat != null) cov.ttm++; if (f1.growth.revenue != null || f1.growth.pbtPre != null) cov.growth++; if (f1.growth.revenueCagr3 != null) cov.cagr3++; if (f1.bs) cov.balanceSheet++; if (f1.earningsYield != null) cov.earningsYield++; if (f1.fiscalYears.length) cov.fiscalEnd++; if (f1.financial) cov.financial++; if (f1.sue.value != null) cov.sue++;
  rows[p.sym] = { entity: p.sym, tradedValue: Math.round(p.value), ...f1, flags: { ...flagsOf(f1), pledge: null } };
}
const graham = grahamList({ el: list, fund: rows, series: new Map(), t, dates: [], held: new Set(), st: {} });
cov.graham = graham.length;
cov.noInterest = Object.values(rows).filter((r) => !r.financial && r.interestCover == null).length;   // non-financial names with no interest-expense figure: not scored by A3, A5 and A6, shown on those cards
const out = { version: 'FUND-US-1', asOf: D, source: 'data/us/facts (SEC EDGAR company facts), prices from the Nasdaq-sourced store', universe: 500, graham, flagsNote: 'no pledge flag for US names', coverage: cov, rows };
mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true }); writeFileSync(OUT, JSON.stringify(out));
console.log(D, JSON.stringify(cov));
