// Assembles the dashboard's one data file (site/data/dashboard.json) from the Repo Desk's stored data. No network. Run after any data change.
// Regime and sector ranking use the same engine as the nightly alerts and the app rules.
import './build-pm-site.mjs';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { makeCalendar } from '../src/engine/calendar.ts';
import { regimeFrom } from '../src/engine/regime.ts';
import { rankSectors } from '../src/engine/sectors.ts';
import { targetSession } from '../src/ingest/nightly-plan.ts';
import { usTarget } from '../src/ingest/us-plan.ts';

const read = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const calJson = JSON.parse(readFileSync('data/calendar/markets-2026.json', 'utf8'));
const cals = {
  india: makeCalendar([...calJson.india.holidays, ...(calJson.india.priorHolidays || [])]),
  us: makeCalendar(calJson.us.holidays),
};
const now = Date.now();
const expected = { india: targetSession(now, cals.india).target, us: usTarget(now, cals.us).target };

function market(m) {
  const files = readdirSync(`data/${m}/tracker`).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(-130);
  const breadth = read(`data/${m}/breadth.json`, {});
  const rows = files.map((f) => { const date = f.slice(0, 10); return { ...read(`data/${m}/tracker/${f}`), date, ...(breadth[date] ? { breadth: breadth[date].pct } : {}) }; });
  const opts = { cal: cals[m] };
  const timeline = [];
  for (let i = Math.max(0, rows.length - 40); i < rows.length; i++) {
    const r = regimeFrom(rows.slice(0, i + 1), opts);
    if (r && !r.incomplete) timeline.push({ date: rows[i].date, regime: r.name });
  }
  const last = regimeFrom(rows, opts);
  const regime = last && !last.incomplete ? {
    name: last.name, notes: last.notes, breadth: Number.isFinite(last.breadth) ? last.breadth : null, breadthDate: last.breadthDate || null,
    distribution: last.analysis.active.map((d) => ({ date: d.date, chg: Math.round(d.chg * 100) / 100 })),
    followThrough: last.analysis.status, trendLevels: { a: last.la, b: last.lb }, risingA: last.risingA, risingB: last.risingB,
  } : null;
  const feed = read(`data/${m}/feed/latest.json`, {});
  const mode = regime?.name === 'red' ? 'red' : 'normal';
  const inputs = Object.entries(feed.sectors || {}).map(([name, s]) => ({ name, m1: s.r1m, m3: s.r3m, above50: s.close > s.sma50, above200: s.close > s.sma200 }));
  const ranked = rankSectors(inputs, feed.bench?.r3m, mode);
  const sectors = Object.entries(feed.sectors || {}).map(([name, s]) => ({ name, close: s.close, r1m: s.r1m, r3m: s.r3m, sma50: s.sma50, sma200: s.sma200, ...ranked.find((x) => x.name === name) && { pass: ranked.find((x) => x.name === name).pass, rank: ranked.find((x) => x.name === name).rank, score: ranked.find((x) => x.name === name).score } }));
  return {
    date: rows.at(-1)?.date ?? null, expected: expected[m], feedDate: feed.date ?? null, fetchedAt: feed.fetchedAt ?? null,
    index: rows.slice(-60).map((r) => ({ date: r.date, close: r.close, sma50: r.sma50, sma200: r.sma200, volume: r.volume, vix: r.vix })),
    latest: rows.at(-1) ? { ...rows.at(-1) } : null, regime, timeline, benchmarkR3m: feed.bench?.r3m ?? null, benchmarkR1m: feed.bench?.r1m ?? null,
    sectors, mode, breadthSeries: Object.entries(breadth).sort().slice(-30).map(([date, v]) => ({ date, pct: v.pct, n: v.n })), flags: feed.flags || [],
  };
}
const india = market('india'), us = market('us');

// India whole-market store: summary only (the store itself is large)
const st = read('data/india/stocks/latest.json', {});
india.stocks = st.date ? { date: st.date, count: st.count, with200: Object.values(st.stocks || {}).filter((s) => s.sma200 !== undefined && s.sma200 !== null).length, corporate: { unresolved: (st.corporateActions?.unresolved || []).length, adjusted: (st.corporateActions?.resolved || []).length } } : null;

// US weekly screen
const sc = read('data/us/screen/latest.json', null);
us.screen = sc ? { date: sc.date, feedDate: sc.feedDate, fetchedAt: sc.fetchedAt, sectors: sc.sectors, flags: sc.flags, stocks: sc.stocks } : null;

// Health
const lr = (p) => read(p, null);
const jobs = [
  ['India index', 'data/india/last-run.json'], ['India stocks', 'data/india/last-run-stocks.json'], ['US daily', 'data/us/last-run.json'], ['US screen', 'data/us/screen/last-run.json'],
].map(([name, p]) => { const r = lr(p); return r ? { name, ts: r.ts, date: r.date ?? null, status: r.status, flags: (r.flags || []).slice(0, 6) } : { name, ts: null, date: null, status: 'never run', flags: [] }; });
const health = { jobs, usage: read('data/ops/usage.json', null), orchestrator: { india: read('data/india/orchestrator.json', {}), us: read('data/us/orchestrator.json', {}) },
  regimeState: { india: read('data/india/regime.json', null), us: read('data/us/regime.json', null) } };

// Data store coverage: what the repo holds beyond the nightly tracker (back-fill, NSE history, rules)
const dayFiles = (d, re) => (existsSync(d) ? readdirSync(d).filter((f) => re.test(f)).sort() : []);
const span = (fs) => ({ days: fs.length, first: fs[0]?.slice(0, 10) ?? null, last: fs.at(-1)?.slice(0, 10) ?? null });
const dirKb = (d) => (existsSync(d) ? Math.round(readdirSync(d).reduce((a, f) => a + statSync(`${d}/${f}`).size, 0) / 1024) : 0);
const ca = read('data/india/corp-actions-history.json', []);
const caDates = ca.map((r) => r.exDate).filter(Boolean).sort();
const amfi = read('data/rules/amfi-schemes.json', null), gm = read('data/us/grouped-meta.json', {});
const store = {
  usGrouped: { ...span(dayFiles('data/us/grouped', /^\d{4}-\d\d-\d\d\.csv\.gz$/)), mb: Math.round(dirKb('data/us/grouped') / 1024), holidays: (gm.noData || []).length, refused: (gm.refused || []).length, splits: Object.keys(read('data/us/splits.json', {})).length },
  indiaBhav: { ...span(dayFiles('data/india/bhav', /^\d{4}-\d\d-\d\d\.json$/)), mb: Math.round(dirKb('data/india/bhav') / 1024) },
  indiaActions: { rows: ca.length, first: caDates[0] ?? null, last: caDates.at(-1) ?? null },
  amfi: amfi ? { schemes: amfi.rows.length, asOf: amfi.asOf } : null,
  rules: ['charges', 'tax', 'dividend', 'demergers', 'ipos', 'fund-overrides'].map((n) => { const j = read(`data/rules/${n}.json`, {}); return { name: n, records: Array.isArray(j.records) ? j.records.length : null, estimates: Array.isArray(j.records) ? j.records.filter((r) => r.estimate).length : null }; }),
};
const compare = read('data/compare/latest.json', null);
const out = { generatedAt: new Date(now).toISOString(), expected, india, us, health, compare, store };
mkdirSync('site/data', { recursive: true });
// Keep the old file when only the build time changed, so the tick does not commit every half hour.
const prev = read('site/data/dashboard.json', null);
const same = prev && JSON.stringify({ ...prev, generatedAt: 0 }) === JSON.stringify({ ...out, generatedAt: 0 });
if (!same) writeFileSync('site/data/dashboard.json', JSON.stringify(out) + '\n');

// Reference documents shown on the Docs tab. Public-safe set only: the Portfolio Manager design and the save-setup note carry household detail and stay out.
const DOCS = [
  ['status', 'Status: confident, not confident, what is left', 'Status', 'docs/STATUS.md'],
  ['rules', 'Engine Rules', 'Rules', 'docs/ENGINE_RULES.md'], ['arch', 'Code and Architecture', 'Rules', 'docs/ARCHITECTURE.md'], ['screener', 'Screener brief', 'Rules', 'docs/SCREENER_BRIEF.md'],
  ['prereg-ind', 'C-54 India baseline (pre-registration)', 'Pre-registrations', 'docs/replay/IND-BASE-1-PREREG.md'],
  ['prereg-paper', 'C-53 paper book (pre-registration)', 'Pre-registrations', 'docs/replay/US-PAPER-BOOK-PREREG.md'],
  ['prereg-scan2', 'C-52 US-SCAN-2 (pre-registration)', 'Pre-registrations', 'docs/replay/US-SCAN-2-PREREG.md'],
  ['prereg-scan1', 'C-51 US-SCAN-1 replay (pre-registration)', 'Pre-registrations', 'docs/replay/US-SCAN-REPLAY-PREREG.md'],
  ['res-ind1', 'C-54 India baseline result, 17 Oct 2026', 'Results', 'docs/replay/IND-BASE-1-RESULT-2026-10-17.md'],
  ['res-scan2', 'C-52 result, 16 Oct 2026', 'Results', 'docs/replay/US-SCAN-2-RESULT-2026-10-16.md'],
  ['res-scan1', 'C-51 result, 16 Oct 2026', 'Results', 'docs/replay/US-SCAN-REPLAY-RESULT-2026-10-16.md'],
  ['res-b1015c', 'India exit test, 15 Oct (adjusted, dividends)', 'Results', 'docs/replay/BASELINE-2026-10-15-adjusted-div.md'],
  ['res-b1015', 'India exit test, 15 Oct (C-50)', 'Results', 'docs/replay/BASELINE-2026-10-15-c50.md'],
];
const docs = DOCS.filter(([, , , f]) => existsSync(f)).map(([id, title, group, f]) => ({ id, title, group, file: f, md: readFileSync(f, 'utf8') }));
const prevDocs = read('site/data/docs.json', null);
if (!prevDocs || JSON.stringify(prevDocs.docs) !== JSON.stringify(docs)) writeFileSync('site/data/docs.json', JSON.stringify({ generatedAt: new Date(now).toISOString(), docs }) + '\n');
console.log(`site/data/dashboard.json ${Math.round(JSON.stringify(out).length / 1024)} KB; India ${india.date} (${india.regime?.name}), US ${us.date} (${us.regime?.name})`);
