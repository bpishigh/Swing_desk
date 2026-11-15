// Count-only signal run, package 36b.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE, tierCost } from '../src/backtest/ind-base.ts';
import { isMonthStart } from '../src/engine/first-wave.ts';
import { weightedRs, percentiles, templateSeven, MV } from '../src/engine/batch-c.ts';
import { baseAt, breakoutVolume, SEPA } from '../src/engine/sepa.ts';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const FROM = arg('from', '2020-01-01'), TO = arg('to', '9999-12-31'), OUT = arg('out', 'docs/replay'), SMOKE = process.argv.includes('--smoke');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
BASE.universe = 500;

const raw = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
if (process.argv.includes('--pre')) for (const f of readdirSync('data/india/bhav-pre2020').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-pre2020/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
raw.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
const actions = [...(process.argv.includes('--pre') ? R('data/india/corp-actions-history-pre2019.json', []) : []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date);
const industry = R('data/india/segments.json', {}).industry ?? {}, names = R('data/names.json', { india: {} }).india ?? {}, allowed = new Set(Object.keys(industry));
for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const isCo = (sym) => sym in industry || sym in names;
const FH = buildHistories(days, res.splits, allowed), series = FH.series;
// Count-only run for package 36b (docs/MINERVINI_SEPA.md v3): signals per year through the price chain. No orders, no returns are computed or printed.
// Funnel per session over the wide eligible list (price Rs 20, history, Rs 5 crore median traded value; rebuilt monthly): template passers (eight tests) -> a valid base whose pivot the close has just crossed -> breakout volume.
// Upper bound: the earnings screen (about 95% of template passers fail it, per the owner's source sheet) is not applied.
const idx = (() => { const o = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) o[d] = v[3]; } return o; })();
const t0 = Math.max(1, dates.findIndex((d) => d >= FROM)); let t1 = dates.length - 1; while (t1 > t0 && dates[t1] > TO) t1--;
const idxD = Object.keys(idx).sort(); const idxC = new Float64Array(dates.length); { let j = 0, last = NaN; for (let t = 0; t < dates.length; t++) { while (j < idxD.length && idxD[j] <= dates[t]) { last = idx[idxD[j]]; j++; } idxC[t] = last; } }
const Y = {}, add = (y, k, n = 1) => { (Y[y] ??= { sessions: 0, tpl: 0, base: 0, baseFlat: 0, baseContr: 0, vol: 0, volDepth: 0, names: new Set(), namesVol: new Set(), contr: {} })[k] += n; };
let el = [], mon = '';
const BU = BASE.universe; 
for (let t = t0; t <= t1; t++) {
  const D = dates[t], y = D.slice(0, 4); if (D.slice(0, 7) !== mon) { mon = D.slice(0, 7); BASE.universe = 100000; try { el = eligible(asOfHistories(days.slice(0, t + 1), t, res, allowed), t, BASE.skip).filter((p) => isCo(p.sym)); } finally { BASE.universe = BU; } }
  add(y, 'sessions');
  const rs = new Map(); for (const n of el) { const s = series.get(n.sym); if (!s) continue; const v = weightedRs(s.c, t); if (Number.isFinite(v)) rs.set(n.sym, v); }
  const pc = percentiles(rs);
  for (const n of el) { const r = pc.get(n.sym), s = series.get(n.sym); if (r == null || !s || r < MV.rsMin) continue; if (templateSeven(s, t) !== true) continue;
    add(y, 'tpl'); const b = baseAt(s, t, idxC); if (!b) continue; add(y, 'base'); add(y, b.kind === 'flat' ? 'baseFlat' : 'baseContr'); Y[y].names.add(n.sym);
    if (s.v && breakoutVolume(s.v, t)) { add(y, 'vol'); Y[y].namesVol.add(n.sym); Y[y].contr[b.kind === 'flat' ? 'flat' : b.contractions.length] = (Y[y].contr[b.kind === 'flat' ? 'flat' : b.contractions.length] ?? 0) + 1; } }
}
const rows = Object.keys(Y).sort().map((y) => { const o = Y[y]; return `| ${y} | ${o.sessions} | ${o.tpl} | ${o.base} (${o.baseContr} contraction, ${o.baseFlat} flat) | ${o.names.size} | ${o.vol} | ${o.namesVol.size} | ${Object.entries(o.contr).map(([k, v]) => k + ':' + v).join(' ')} |`; });
const out = `# Package 36b count-only run (${FROM} to ${dates[t1]})\n\nCount of signals through the price chain only. No orders, no returns, no comparison with any index was computed. Upper bound: the earnings screen is not applied (about 95% of template passers fail it, per the owner's source sheet).\n\n| Year | Sessions | Template-name-days | Base breakouts (name-days) | Distinct names with a base breakout | Base breakouts with volume 150% of 50-day average | Distinct names | Contractions in the base (volume days) |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\nDesk figures in force: ${JSON.stringify(SEPA)}. Wide list rebuilt monthly; names not in today's company list are dropped (survivor bias).\n`;
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/SEPA-COUNT.md`, out); console.log(out);
