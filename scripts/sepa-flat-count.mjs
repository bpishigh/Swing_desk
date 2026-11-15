// Flat-base count, package 36b.
// Count-only signal run, package 36b.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE, tierCost } from '../src/backtest/ind-base.ts';
import { isMonthStart } from '../src/engine/first-wave.ts';
import { weightedRs, percentiles, templateSeven, MV } from '../src/engine/batch-c.ts';
import { priorAdvance, SEPA } from '../src/engine/sepa.ts';
import { asOfResults } from '../src/engine/filings-asof.ts';

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

// Package 36b, flat-base count (owner "go" 15 Nov 2026, reviewer's pre-set definition). Counts only: trades are placed on the slot calendar to count them, no profit or loss is computed or printed.
// Flat base (fixed by the book before counting): 20 to 35 sessions, depth at most 15%, range high set at least 5 sessions ago, prior advance 30%, close above the range high for the first time (yesterday's close not above it), at most 5% above;
// volume: the 10 sessions before the signal average below the 50-session average (dry-up), and the signal day at least 150% of that average (desk figure). Variant: depth at most 10% (information only).
// Earnings: latest quarter's PAT growth year on year at least 25% (also 20% shown) and the two quarters before it above zero; a missing figure is not a fail (reported separately). 2021 on only.
// Slots: 6 positions, ties broken by highest RS rank. Occupancy calendar (for counting only): a position leaves at a 10% stop on the daily low, or when the 50-day average is above entry and the close is below it, or after 250 sessions.
const ents = R('data/india/entities.json').entities, bySym = new Map();
for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push([u, e]); bySym.set(u.symbol, a); }
const entityOf = (sym, D) => { const a = bySym.get(sym); if (!a) return null; return (a.find(([u]) => (u.from == null || u.from <= D) && (u.to == null || u.to >= D)) || a[a.length - 1])[1]; };
const splitsOf = new Map(); for (const [sym, date, factor] of res.splits) { const a = splitsOf.get(sym) || []; a.push({ date, factor }); splitsOf.set(sym, a); }
const stores = new Map();   // entity id -> {facts, days:Set}
const storeOf = (e) => { if (stores.has(e.id)) return stores.get(e.id); const p = `data/india/filings/${e.id}.json.gz`; let o = null;
  if (existsSync(p)) { const s = JSON.parse(gunzipSync(readFileSync(p))); const facts = s.results.filter((y) => y.asOf).map((y) => ({ entity: e.id, period: y.period, basis: y.basis, asOf: y.asOf, revision: y.revision ?? 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra })); o = { facts, days: new Set(facts.filter((f) => !f.revision).map((f) => f.asOf.slice(0, 10))) }; }
  stores.set(e.id, o); return o; };
const idx = (() => { const o = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) o[d] = v[3]; } return o; })();
const t0 = Math.max(1, dates.findIndex((d) => d >= FROM)); let t1 = dates.length - 1; while (t1 > t0 && dates[t1] > TO) t1--;
const idxD = Object.keys(idx).sort(); void idxD;
const sma = (c, t, n) => { let s = 0; for (let i = t - n + 1; i <= t; i++) { if (!(c[i] > 0)) return NaN; s += c[i]; } return s / n; };
const avgV = (v, a, b) => { let s = 0, k = 0; for (let i = a; i <= b; i++) if (v[i] > 0) { s += v[i]; k++; } return k ? s / k : NaN; };
function flat(s, t, maxDepth) {
  const c = s.c, h = s.h, l = s.l; if (!(c[t] > 0) || !(c[t - 1] > 0)) return null;
  for (let n = 20; n <= 35; n++) {
    let hi = -Infinity, lo = Infinity, bad = false; for (let i = t - n; i < t; i++) { if (!(h[i] > 0) || !(l[i] > 0)) { bad = true; break; } if (h[i] > hi) hi = h[i]; if (l[i] < lo) lo = l[i]; }
    if (bad) continue; let ihi = t - n; for (let i = t - n; i < t; i++) if (h[i] >= hi) { ihi = i; break; }
    const d = (hi - lo) / hi; if (ihi > t - 5 || d > maxDepth || !(c[t] > hi) || c[t] > hi * 1.05 || c[t - 1] > hi || !priorAdvance(c, t - n)) continue;
    return { pivot: hi, depth: d, length: n };
  }
  return null;
}
const Ys = {}; const Y = (y) => (Ys[y] ??= { tplDays: 0, tplFig: 0, base15: 0, base10: 0, dry: 0, vol: 0, volNoDry: 0, e25: 0, e20: 0, noFig: 0, e25names: new Set(), tk_p: 0, tk_25: 0, tk_20: 0, skip_p: 0, skip_25: 0, skip_20: 0 });
const last = {}; // sym -> last event index (35-session cooldown, so one signal per base)
const figOf = (sym, D) => { const e = entityOf(sym, D); if (!e) return null; const st = storeOf(e); if (!st) return null; const view = asOfResults(st.facts, e.id, D, { limit: 8, events: e.events }); const q = view.quarters.slice(0, 3); if (q.length < 3) return null; const g = q.map((x) => x.yoy?.pat); if (g.some((v) => v == null || !Number.isFinite(v))) return null; return g; };
const cals = { p: [], e25: [], e20: [] };   // per scenario: list of open positions {sym, entry, t0, stopped}
const open = { p: [], e25: [], e20: [] };
let el = [], mon = '';
const exitCheck = (pos, t) => { const s = series.get(pos.sym); if (!s) return true; if (s.l[t] > 0 && s.l[t] <= pos.entry * 0.9) return true; if (t - pos.t0 >= 250) return true; const m = sma(s.c, t, 50); if (m > pos.entry && s.c[t] < m) return true; return false; };
const events = {};   // t -> list of {sym, rs, fig}
for (let t = t0; t <= t1; t++) {
  const D = dates[t], y = D.slice(0, 4);
  for (const k of Object.keys(open)) open[k] = open[k].filter((p) => !(t > p.t0 && exitCheck(p, t)));
  if (D.slice(0, 7) !== mon) { mon = D.slice(0, 7); const u = BASE.universe; BASE.universe = 100000; try { el = eligible(asOfHistories(days.slice(0, t + 1), t, res, allowed), t, BASE.skip).filter((p) => isCo(p.sym)); } finally { BASE.universe = u; } }
  const rs = new Map(); for (const n of el) { const s = series.get(n.sym); if (!s) continue; const v = weightedRs(s.c, t); if (Number.isFinite(v)) rs.set(n.sym, v); }
  const pc = percentiles(rs), today = [];
  for (const n of el) { const r = pc.get(n.sym), s = series.get(n.sym); if (r == null || !s || !s.h || !s.l || r < MV.rsMin || templateSeven(s, t) !== true) continue;
    const o = Y(y); o.tplDays++; const f10 = flat(s, t, 0.10), f15 = f10 ?? flat(s, t, 0.15);
    if (f10) o.base10++; if (!f15) continue; if (last[n.sym] != null && t - last[n.sym] < 35) continue; last[n.sym] = t; o.base15++;
    const v = s.v; const a50 = avgV(v, t - 50, t - 1), dry = avgV(v, t - 10, t - 1) < a50, vol = v[t] >= 1.5 * a50;
    if (vol) o.volNoDry++; if (!(dry && vol)) { if (dry) o.dry++; continue; } o.dry++; o.vol++;
    let fig = null, e25 = null, e20 = null; if (y >= '2021') { fig = figOf(n.sym, D); if (fig) { o.tplFig++; e25 = fig[0] >= 0.25 && fig[1] > 0 && fig[2] > 0; e20 = fig[0] >= 0.20 && fig[1] > 0 && fig[2] > 0; if (e25) { o.e25++; o.e25names.add(n.sym); } if (e20) o.e20++; } else o.noFig++; }
    today.push({ sym: n.sym, rs: r, e25, e20, y, entry: s.c[t] }); }
  today.sort((a, b) => b.rs - a.rs);
  for (const k of ['p', 'e25', 'e20']) for (const c of today) { if (k !== 'p') { if (c.y < '2021' || !c[k]) continue; } if (open[k].some((p) => p.sym === c.sym)) continue; const o = Y(c.y); if (open[k].length < 6) { open[k].push({ sym: c.sym, entry: c.entry, t0: t }); o['tk_' + (k === 'p' ? 'p' : k.slice(1))]++; } else o['skip_' + (k === 'p' ? 'p' : k.slice(1))]++; }
}
const yrs = Object.keys(Ys).sort(); const row = (y) => { const o = Ys[y]; return `| ${y} | ${o.tplDays} | ${o.base10}/${o.base15} | ${o.volNoDry} | ${o.dry} | ${o.vol} | ${y >= '2021' ? o.tplFig + ' of ' + o.vol : 'n/a'} | ${y >= '2021' ? o.e25 + ' (' + o.e25names.size + ' names) / ' + o.e20 : 'n/a'} | ${o.tk_p} (skipped ${o.skip_p}) | ${y >= '2021' ? o.tk_25 + ' (skipped ' + o.skip_25 + ') / ' + o.tk_20 : 'n/a'} |`; };
const ey = yrs.filter((y) => y >= '2021' && y < '2026'), full = yrs.filter((y) => y >= '2021'); const avg = (k, ys) => (ys.reduce((a, y) => a + Ys[y][k], 0) / ys.length).toFixed(1);
const under = (k, ys) => ys.filter((y) => Ys[y][k] < 10).length;
const out = `# Package 36b flat-base count (${FROM} to ${dates[t1]})\n\nCounts only. Trades are placed on a six-slot calendar (10% stop on the daily low, 50-day rule, 250-session cap) only to count how many would be taken; no profit or loss was computed or printed. Definition fixed before the run: see the header of scripts/sepa-flat-count.mjs.\n\n| Year | Template name-days | Flat bases (depth 10 / 15 or less), first signal | Breakout volume only | Volume dry-up | Dry-up and breakout volume (primary) | Primary with an earnings figure | With earnings 25% (20%) | Taken, price chain only | Taken with earnings 25% (20%) |\n|---|---|---|---|---|---|---|---|---|---|\n${yrs.map(row).join('\n')}\n\nEarnings years 2021 to 2025 (full years): taken per year averages ${avg('tk_p', ey)} (price only), ${avg('tk_25', ey)} (earnings 25%), ${avg('tk_20', ey)} (earnings 20%). Years under 10 trades: ${under('tk_p', ey)}, ${under('tk_25', ey)}, ${under('tk_20', ey)} of ${ey.length}. Pre-set line: at least 20 taken a year. Years 2021 to 2025 meeting it: ${ey.filter((y) => Ys[y].tk_25 >= 20).length} (earnings 25%), ${ey.filter((y) => Ys[y].tk_20 >= 20).length} (earnings 20%), ${ey.filter((y) => Ys[y].tk_p >= 20).length} (price only). 2026 is part-year.\n\nA missing earnings figure is not treated as a fail; it is the gap between the primary count and the "with an earnings figure" count. Wide list rebuilt monthly; names not in today's company list are dropped (survivor bias).\n`;
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/SEPA-FLAT-COUNT.md`, out); console.log(out);
