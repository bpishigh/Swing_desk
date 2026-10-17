// Nightly US whole-market scan (C-20a). Reads the stored Massive grouped bars, the tickers reference list, splits and (if present) the SIC file;
// writes data/us/scan/<date>.json, latest.json and state.json (qualification hysteresis). Changes no rule.
// Usage: node scripts/us-scan.mjs [--asof=YYYY-MM-DD] [--dry]   (--dry prints the summary and writes nothing)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories, runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';
import { loadDays } from './us-hist-lib.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const DRY = process.argv.includes('--dry');
const HIST = arg('source') === 'hist';   // Nasdaq-sourced store (data/us/hist + tails); writes to data/us/scan-hist so the frozen Massive-sourced output is untouched during the parity check
const OUT = HIST ? 'data/us/scan-hist' : 'data/us/scan';
const ASOF = arg('asof');
const dir = 'data/us/grouped';
let files = HIST ? [] : readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.csv\.gz$/.test(f)).sort();
if (ASOF) files = files.filter((f) => f.slice(0, 10) <= ASOF);
if (!HIST && files.length < SCAN.minSessions + 1) { console.error('too few stored days: ' + files.length); process.exit(1); }

const tickersFile = readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop();
if (!tickersFile) { console.error('no tickers reference file'); process.exit(1); }
const tk = JSON.parse(readFileSync('data/us/' + tickersFile, 'utf8'));
const types = new Map(); for (const [sym, type] of tk.rows) if (SCAN.types.includes(type)) types.set(sym, type);
const allowed = new Set(types.keys());

const days = HIST ? loadDays(ASOF).map((d) => ({ date: d.date, rows: d.rows.filter((r) => allowed.has(r[0])) })) : files.map((f) => {
  const lines = gunzipSync(readFileSync(`${dir}/${f}`)).toString('utf8').split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(','); if (p.length < 5) continue;
    const c = +p[1], h = +p[2], l = +p[3], v = +p[4];
    if (allowed.has(p[0]) && c > 0 && h > 0 && l > 0) rows.push([p[0], c, h, l, v]);
  }
  return { date: f.slice(0, 10), rows };
});
const splits = HIST ? [] : JSON.parse(readFileSync('data/us/splits.json', 'utf8')).rows;   // Nasdaq prices are already split-adjusted
const sic = new Map();
if (existsSync('data/us/sic.json')) for (const [sym, code] of JSON.parse(readFileSync('data/us/sic.json', 'utf8')).rows) if (code) sic.set(sym, +code);
const regime = JSON.parse(readFileSync('data/us/regime.json', 'utf8')).latest;
const light = ['green', 'yellow', 'red'].includes(regime?.name) ? regime.name : 'yellow';
const stateFile = `${OUT}/state.json`;
const prev = !ASOF && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).state ?? {} : {};

const hist = buildHistories(days, splits, allowed);
const out = runScan({ hist, types, sic, light, prev });
out.regimeDate = regime?.date ?? null;
out.sicCovered = sic.size;
const summary = { asOf: out.asOf, light, funnel: out.funnel, sicCovered: sic.size, groupsRanked: out.groups.length, ready: out.ready.length, watch: out.watch.length, noGroupQualified: out.noGroup.qualified, thinGroupQualified: out.thinGroup.qualified };
console.log(JSON.stringify(summary));
if (!DRY) {
  mkdirSync(OUT, { recursive: true });
  const { state, ...doc } = out;
  writeFileSync(`${OUT}/${out.asOf}.json`, JSON.stringify(doc, null, 1) + '\n');
  writeFileSync(`${OUT}/latest.json`, JSON.stringify(doc, null, 1) + '\n');
  writeFileSync(stateFile, JSON.stringify({ asOf: out.asOf, state }) + '\n');
}
