// Nightly India whole-market scan (IND-SCAN-1). Same engine as the US scan (runScan) with India settings. Reads NSE bhav history, corporate actions and the
// industry map; writes data/india/scan/<date>.json, latest.json and state.json (qualification hysteresis). Changes no rule.
// Usage: node --max-old-space-size=6000 scripts/india-scan.mjs [--asof=YYYY-MM-DD] [--dry]
import { chartFor } from '../src/ingest/scan-chart.ts';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runScan } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, topShare } from '../src/backtest/ind-base.ts';
import { SETUPS } from '../src/engine/setups.ts';

const ASOF = process.argv.find((a) => a.startsWith('--asof='))?.slice(7);
const DRY = process.argv.includes('--dry');
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
const sel = ASOF ? uniq.filter((d) => d.date <= ASOF) : uniq;
if (sel.length < INDIA_SCAN.minSessions + 1) { console.error('too few stored days: ' + sel.length); process.exit(1); }
const actions = [...JSON.parse(readFileSync('data/india/corp-actions-history.json')), ...(existsSync('data/india/corp-actions.json') ? JSON.parse(readFileSync('data/india/corp-actions.json')) : [])];
const ov = { ...(existsSync('data/india/corp-action-overrides-hist.json') ? JSON.parse(readFileSync('data/india/corp-action-overrides-hist.json')) : {}), ...(existsSync('data/india/corp-action-overrides.json') ? JSON.parse(readFileSync('data/india/corp-action-overrides.json')) : {}) };   // hand overrides win over rule-derived ones
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
const diagRows = [];   // output only: the scan's independent geometry tests, used for the geometry log below
const out = runScan({ hist, types, sic: new Map(), light, prev, settings: INDIA_SCAN, version: INDIA_SCAN_VERSION, groupOf: (s) => industry[s] ?? null, setupsByLight: INDIA_SETUPS, diagRows });
out.regimeDate = reg?.date ?? null; out.industryCovered = Object.keys(industry).length;
out.notes = out.notes.filter((n) => !/SIC|US-SCAN|signed off|C-20a/.test(n));
out.notes.push('IND-SCAN-1: the US scan method with India settings (src/ingest/india-scan-settings.ts). The universe is the NSE index lists (Nifty 500 and the segment lists in segments.json) because only they carry an industry; groups are NSE\'s broad industries. Results dates are not checked.');
const summary = { asOf: out.asOf, light, funnel: out.funnel, industryCovered: out.industryCovered, groupsRanked: out.groups.length, ready: out.ready.length, watch: out.watch.length, noGroupQualified: out.noGroup.qualified, thinGroupQualified: out.thinGroup.qualified };
console.log(JSON.stringify(summary));
{ // chart data for the Ready and Watch names (output only); --charts writes it even on a dry run
  const charts = {}; for (const c of [...out.ready, ...out.watch]) { const d = chartFor(hist, c.sym, c.setup); if (d) charts[c.sym] = d; }
  if (!DRY || process.argv.includes('--charts')) { mkdirSync(`data/india/scan`, { recursive: true }); writeFileSync(`data/india/scan/charts.json`, JSON.stringify({ asOf: out.asOf, charts }) + '\n'); }
}

{ // forward-test inputs (C-66), output only: the month's momentum list (C-54 rule, first session of the month) and tonight's desk-geometry candidates
  if (!DRY || process.argv.includes('--extras')) {
    const mfile = `data/india/momentum/${out.asOf.slice(0, 7)}.json`;
    if (!existsSync(mfile)) { const top = topShare(eligible(hist, t)); mkdirSync('data/india/momentum', { recursive: true }); writeFileSync(mfile, JSON.stringify({ month: out.asOf.slice(0, 7), date: out.asOf, rule: 'C-54 12-1 momentum, top decile of the 500 most traded names in the scan universe, computed on the first session run of the month', names: top.map((p) => p.sym).sort() }) + '\n'); }
    const topG = new Set(out.groups.filter((g) => g.passes).map((g) => g.group)), rows = [];
    for (const r of diagRows) {
      if (!topG.has(industry[r.sym]) || r.path !== 'main') continue;
      for (const [id, geo, trig, stopAt, width, cap, room] of [['1', r.geoBreakout && r.tight, r.brkTrig, r.brkStopAt, r.brkWidth, r.brkCap, r.brkRoomR], ['2', r.geoPull20, r.p20Trig, r.p20StopAt, r.p20Width, r.p20Cap, r.p20RoomR], ['4', r.geoPull50, r.p50Trig, r.p50StopAt, r.p50Width, r.p50Cap, r.p50RoomR]]) {
        if (!geo || !(trig > 0) || !(stopAt > 0) || !(width > 0) || width > 1.5 * cap) continue;
        rows.push({ sym: r.sym, group: industry[r.sym], id, cls: width <= cap ? (room === null || room >= 3 ? 'valid' : 'lowRoom') : 'tooWide', trigger: trig, stop: stopAt, limit: +(trig * (1 + SETUPS[id].lim / 100)).toFixed(2), basis: id === '1' ? +(trig / (1 + SETUPS[id].trig / 100)).toFixed(2) : trig, width, room });
      }
    }
    mkdirSync('data/india/scan', { recursive: true }); writeFileSync('data/india/scan/geometry.json', JSON.stringify({ asOf: out.asOf, light, rows }) + '\n'); console.log(`geometry candidates ${rows.length}`);
  }
}
if (!DRY) {
  mkdirSync('data/india/scan', { recursive: true });
  const { state, ...doc } = out;
  writeFileSync(`data/india/scan/${out.asOf}.json`, JSON.stringify(doc, null, 1) + '\n');
  writeFileSync('data/india/scan/latest.json', JSON.stringify(doc, null, 1) + '\n');
  writeFileSync(stateFile, JSON.stringify({ asOf: out.asOf, state }) + '\n');
}
