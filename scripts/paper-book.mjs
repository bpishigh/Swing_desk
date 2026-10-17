// US paper book (C-53): nightly step after the scan. Reads the night's top-10 list, advances the paper positions on the day's bars, creates tonight's orders.
// Writes data/us/paper/book.json (the whole ledger) and data/us/paper/latest.json (summary). Logs only after data/us/paper/enabled.json exists (written when the owner confirms C-53).
// Usage: node scripts/paper-book.mjs [--force]            nightly
//        node scripts/paper-book.mjs --replay --out=PATH   dry run over the stored history (Yellow, no rule 9), writes only PATH
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories, runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';
import { advance, applySplits, newBook, newOrders, summarize } from '../src/ingest/paper-book.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const REPLAY = process.argv.includes('--replay'), FORCE = process.argv.includes('--force');
const dir = 'data/us/paper';
if (!REPLAY && !FORCE && !existsSync(`${dir}/enabled.json`)) { console.log('paper book not enabled (no data/us/paper/enabled.json): nothing logged'); process.exit(0); }

const gdir = 'data/us/grouped', files = readdirSync(gdir).filter((f) => /^\d{4}-\d\d-\d\d\.csv\.gz$/.test(f)).sort();
const tk = JSON.parse(readFileSync('data/us/' + readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop(), 'utf8'));
const types = new Map(); for (const [s, t] of tk.rows) if (SCAN.types.includes(t)) types.set(s, t);
const allowed = new Set(types.keys());
const days = files.map((f) => { const L = gunzipSync(readFileSync(`${gdir}/${f}`)).toString().split('\n'); const rows = []; for (let i = 1; i < L.length; i++) { const p = L[i].split(','); if (p.length < 5) continue; if (allowed.has(p[0]) && +p[1] > 0 && +p[2] > 0 && +p[3] > 0) rows.push([p[0], +p[1], +p[2], +p[3], +p[4]]); } return { date: f.slice(0, 10), rows }; });
const splits = JSON.parse(readFileSync('data/us/splits.json', 'utf8')).rows;
const sic = new Map(JSON.parse(readFileSync('data/us/sic.json', 'utf8')).rows.filter((r) => r[1]).map((r) => [r[0], +r[1]]));
const top10 = (ready, watch) => [...ready, ...watch].sort((a, b) => b.composite - a.composite).slice(0, SCAN.top).map((c) => ({ sym: c.sym, group: c.group, path: c.path }));

if (REPLAY) {
  const OUT = arg('out'); if (!OUT) { console.error('--replay needs --out=PATH'); process.exit(2); }
  const book = newBook(days[SCAN.quarter * 4].date); let prev = {}, prevLight = null;
  for (let t = SCAN.quarter * 4; t < days.length; t++) {
    const hist = buildHistories(days.slice(0, t + 1), splits.filter((r) => r[1] <= days[t].date), allowed);
    applySplits(book, splits, days[t].date);
    advance(book, hist, t, 'yellow', prevLight); prevLight = 'yellow';
    const out = runScan({ hist, types, sic, light: 'yellow', prev }); prev = out.state;
    newOrders(book, hist, t, 'yellow', top10(out.ready, out.watch));
    book.asOf = days[t].date;
  }
  writeFileSync(OUT, JSON.stringify({ summary: summarize(book), ledger: book.ledger }, null, 1) + '\n');
  console.log(JSON.stringify(summarize(book)));
  process.exit(0);
}

// ---- nightly
const scan = JSON.parse(readFileSync('data/us/scan/latest.json', 'utf8'));
const asOf = scan.asOf, t = days.findIndex((d) => d.date === asOf);
if (t < 0) { console.error('scan date not in the stored days: ' + asOf); process.exit(1); }
mkdirSync(dir, { recursive: true });
const bookFile = `${dir}/book.json`;
const book = existsSync(bookFile) ? JSON.parse(readFileSync(bookFile, 'utf8')) : newBook(asOf);
if (book.asOf && book.asOf >= asOf) { console.log(`already processed ${asOf}`); process.exit(0); }
const regime = JSON.parse(readFileSync('data/us/regime.json', 'utf8')).latest;
const light = ['green', 'yellow', 'red'].includes(regime?.name) ? regime.name : 'yellow';
const from = book.asOf ? days.findIndex((d) => d.date > book.asOf) : t;
for (let i = from; i <= t; i++) {
  const hist = buildHistories(days.slice(0, i + 1), splits.filter((r) => r[1] <= days[i].date), allowed);
  applySplits(book, splits, days[i].date);
  advance(book, hist, i, light, book.lastLight);
  if (i === t) newOrders(book, hist, t, light, top10(scan.ready, scan.watch));
  book.lastLight = light; book.asOf = days[i].date;
}
const summary = { ...summarize(book), light, newOrdersTonight: book.ledger.filter((p) => p.signalDate === asOf).map((p) => ({ stream: p.stream, sym: p.sym, setup: p.setup, trigger: +p.trigger.toFixed(2), stop: +p.stop.toFixed(2), tags: p.tags })), open: book.ledger.filter((p) => p.status === 'open').map((p) => ({ stream: p.stream, sym: p.sym, setup: p.setup, entry: +p.entry.toFixed(2), stop: +p.stop.toFixed(2) })) };
writeFileSync(bookFile, JSON.stringify(book) + '\n');
writeFileSync(`${dir}/latest.json`, JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify({ asOf, light, official: summary.official, capwaived: summary.capwaived, comparator: summary.comparator, newOrders: summary.newOrdersTonight.length }));
