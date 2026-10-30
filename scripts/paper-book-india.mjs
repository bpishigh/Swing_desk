// India paper book (IND-PAPER-1): the C-53 engine on the IND-SCAN-1 top-10 list, three streams (official / capwaived / comparator), daily-close exits, 60-session maximum hold.
// Costs: round-trip tiers 0.35 / 0.50 / 0.80% by 20-day traded value (Rs 100 crore, Rs 25 crore, below), the same as C-54. Logs only after data/india/paper/enabled.json exists.
// Writes data/india/paper/book.json and latest.json. Usage: node --max-old-space-size=6000 scripts/paper-book-india.mjs [--force] | --replay --out=PATH (dry run over stored history, Yellow, writes only PATH)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { INDIA_SCAN } from '../src/ingest/india-scan-settings.ts';
import { runScan } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { advance, applySplits, newBook, newOrders, summarize, useTiers } from '../src/ingest/paper-book.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const REPLAY = process.argv.includes('--replay'), FORCE = process.argv.includes('--force');
const dir = 'data/india/paper';
if (!REPLAY && !FORCE && !existsSync(`${dir}/enabled.json`)) { console.log('India paper book not enabled (no data/india/paper/enabled.json): nothing logged'); process.exit(0); }
useTiers([[1e9, 0.0035], [2.5e8, 0.005], [0, 0.008]]);

const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
const actions = [...JSON.parse(readFileSync('data/india/corp-actions-history.json')), ...(existsSync('data/india/corp-actions.json') ? JSON.parse(readFileSync('data/india/corp-actions.json')) : [])];
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p)) : {});
const ov = { ...rd('data/india/corp-action-overrides-hist.json'), ...rd('data/india/corp-action-overrides.json') };
const res = resolveHistory(uniq, actions, ov);
const days = toDays(uniq);
const industry = JSON.parse(readFileSync('data/india/segments.json', 'utf8')).industry ?? {};
const allowed = new Set(Object.keys(industry)), types = new Map([...allowed].map((s) => [s, 'CS']));
const top10 = (ready, watch) => [...ready, ...watch].sort((a, b) => b.composite - a.composite).slice(0, INDIA_SCAN.top).map((c) => ({ sym: c.sym, group: c.group, path: c.path }));
const scanOf = (hist, light, prev) => runScan({ hist, types, sic: new Map(), light, prev, settings: INDIA_SCAN, version: INDIA_SCAN_VERSION, groupOf: (s) => industry[s] ?? null, setupsByLight: INDIA_SETUPS });

if (REPLAY) {
  const OUT = arg('out'); if (!OUT) { console.error('--replay needs --out=PATH'); process.exit(2); }
  const start = INDIA_SCAN.quarter * 4 + 20, step = Number(arg('step') ?? 1), book = newBook(days[start].date); let prev = {}, prevLight = null;
  for (let t = start; t < days.length; t++) {
    const hist = asOfHistories(days, t, res, allowed);
    applySplits(book, res.splits, days[t].date);
    advance(book, hist, t, 'yellow', prevLight); prevLight = 'yellow';
    if ((t - start) % step === 0) { const out = scanOf(hist, 'yellow', prev); prev = out.state; newOrders(book, hist, t, 'yellow', top10(out.ready, out.watch)); }
    book.asOf = days[t].date;
  }
  writeFileSync(OUT, JSON.stringify({ summary: summarize(book), ledger: book.ledger }, null, 1) + '\n');
  console.log(JSON.stringify(summarize(book))); process.exit(0);
}

const scan = JSON.parse(readFileSync('data/india/scan/latest.json', 'utf8'));
const asOf = scan.asOf, t = days.findIndex((d) => d.date === asOf);
if (t < 0) { console.error('scan date not in the stored days: ' + asOf); process.exit(1); }
mkdirSync(dir, { recursive: true });
const bookFile = `${dir}/book.json`;
const book = existsSync(bookFile) ? JSON.parse(readFileSync(bookFile, 'utf8')) : newBook(asOf);
if (book.asOf && book.asOf >= asOf) { console.log(`already processed ${asOf}`); process.exit(0); }
const reg = JSON.parse(readFileSync('data/india/regime.json', 'utf8')).latest;
const light = ['green', 'yellow', 'red'].includes(reg?.name) ? reg.name : 'yellow';
const from = book.asOf ? days.findIndex((d) => d.date > book.asOf) : t;
for (let i = from; i <= t; i++) {
  const hist = asOfHistories(days, i, res, allowed);
  applySplits(book, res.splits, days[i].date);
  advance(book, hist, i, light, book.lastLight);
  if (i === t) newOrders(book, hist, t, light, top10(scan.ready, scan.watch));
  book.lastLight = light; book.asOf = days[i].date;
}
book.version = 'IND-PAPER-1';
const summary = { ...summarize(book), light, newOrdersTonight: book.ledger.filter((p) => p.signalDate === asOf).map((p) => ({ stream: p.stream, sym: p.sym, setup: p.setup, trigger: +p.trigger.toFixed(2), stop: +p.stop.toFixed(2), status: p.status, kind: p.kind, tags: p.tags, stopPct: +p.stopPct.toFixed(2), maxStopPct: p.maxStopPct, roomR: p.roomR === null ? null : +p.roomR.toFixed(2) }))   // kind/tags/widths added for the Paper test tab (C-113); output only };
writeFileSync(bookFile, JSON.stringify(book) + '\n');
writeFileSync(`${dir}/latest.json`, JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify({ asOf, light, official: summary.official, newOrders: summary.newOrdersTonight.length }));
