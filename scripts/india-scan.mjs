// Nightly India whole-market scan (IND-SCAN-1). Same engine as the US scan (runScan) with India settings. Reads NSE bhav history, corporate actions and the
// industry map; writes data/india/scan/<date>.json, latest.json and state.json (qualification hysteresis). Changes no rule.
// Usage: node --max-old-space-size=6000 scripts/india-scan.mjs [--asof=YYYY-MM-DD] [--dry]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runScan } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';

const ASOF = process.argv.find((a) => a.startsWith('--asof='))?.slice(8);
const DRY = process.argv.includes('--dry');
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
const sel = ASOF ? uniq.filter((d) => d.date <= ASOF) : uniq;
if (sel.length < INDIA_SCAN.minSessions + 1) { console.error('too few stored days: ' + sel.length); process.exit(1); }
const actions = [...JSON.parse(readFileSync('data/india/corp-actions-history.json')), ...(existsSync('data/india/corp-actions.json') ? JSON.parse(readFileSync('data/india/corp-actions.json')) : [])];
const ov = existsSync('data/india/corp-action-overrides.json') ? JSON.parse(readFileSync('data/india/corp-action-overrides.json')) : {};
const res = resolveHistory(sel, actions, ov);
const industry = JSON.parse(readFileSync('data/india/segments.json', 'utf8')).industry ?? {};
const days = toDays(sel), t = days.length - 1;
const allowed = new Set(Object.keys(industry));   // the group step needs an industry, so the universe is the NSE index lists (about 500 names)
const hist = asOfHistories(days, t, res, allowed);
const types = new Map([...allowed].map((s) => [s, 'CS']));
const reg = JSON.parse(readFileSync('data/india/regime.json', 'utf8')).latest;
const light = ['green', 'yellow', 'red'].includes(reg?.name) ? reg.name : 'yellow';
const stateFile = 'data/india/scan/state.json';
const prev = !ASOF && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).state ?? {} : {};
const out = runScan({ hist, types, sic: new Map(), light, prev, settings: INDIA_SCAN, version: INDIA_SCAN_VERSION, groupOf: (s) => industry[s] ?? null, setupsByLight: INDIA_SETUPS });
out.regimeDate = reg?.date ?? null; out.industryCovered = Object.keys(industry).length;
out.notes = out.notes.filter((n) => !/SIC|US-SCAN|signed off|C-20a/.test(n));
out.notes.push('IND-SCAN-1: the US scan method with India settings (src/ingest/india-scan-settings.ts). The universe is the NSE index lists (Nifty 500 and the segment lists in segments.json) because only they carry an industry; groups are NSE\'s broad industries. Results dates are not checked.');
const summary = { asOf: out.asOf, light, funnel: out.funnel, industryCovered: out.industryCovered, groupsRanked: out.groups.length, ready: out.ready.length, watch: out.watch.length, noGroupQualified: out.noGroup.qualified, thinGroupQualified: out.thinGroup.qualified };
console.log(JSON.stringify(summary));
if (!DRY) {
  mkdirSync('data/india/scan', { recursive: true });
  const { state, ...doc } = out;
  writeFileSync(`data/india/scan/${out.asOf}.json`, JSON.stringify(doc, null, 1) + '\n');
  writeFileSync('data/india/scan/latest.json', JSON.stringify(doc, null, 1) + '\n');
  writeFileSync(stateFile, JSON.stringify({ asOf: out.asOf, state }) + '\n');
}
