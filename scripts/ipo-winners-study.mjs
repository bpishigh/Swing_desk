// IPO winners study (docs/replay/IPO-WINNERS-PREREG.md). Descriptive only; no strategy is run here.
// Usage: node --max-old-space-size=7000 scripts/ipo-winners-study.mjs --list=2020-01-02:2022-12-31 --tag=discovery
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
import { tierCost } from '../src/backtest/ind-base.ts';
import { usCost } from '../src/backtest/us-loader.ts';
import { loadDays } from './us-hist-lib.mjs';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const MK = 'in', FROM = arg('from', MK === 'us' ? '2017-01-02' : '2020-01-02'), TO = arg('to', '9999-12-31'), OUT = arg('out', 'docs/replay'), PRE = true, EXTRA = 0.006;
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);


const LIGHT = arg('light', 'one');

let days, dates, splits = [], openAt, tier, compClose, uniqRows = null;
if (MK === 'in') {
  const raw = [];
  for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
  if (PRE) for (const f of readdirSync('data/india/bhav-pre2020').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-pre2020/' + f))));
  for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
  raw.sort((a, b) => (a.date < b.date ? -1 : 1)); const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date); uniqRows = uniq;
  const actions = [...(PRE ? R('data/india/corp-actions-history-pre2019.json', []) : []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
  const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
  const res = resolveHistory(uniq, actions, ov); days = toDays(uniq); dates = days.map((d) => d.date); splits = res.splits;
  openAt = (sym, t) => { const r = uniq[t]?.rows?.[sym]; return r && r[2] > 0 ? r[2] : NaN; }; tier = (v) => tierCost(v) + EXTRA;
  const idx = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) idx[d] = v[3]; }
  compClose = idx;
} else {
  days = loadDays(); dates = days.map((d) => d.date); openAt = () => NaN; tier = (v) => usCost(v) + EXTRA;
  const spy = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/SPY.json.gz')).toString()).bars; compClose = Object.fromEntries(spy.map((b) => [b[0], b[1]]));
}
// IPO list from the stored files (same rule as scripts/india-ipo-list.mjs): first appearance of an EQ symbol, renames removed (India), days with more than 20 first appearances dropped
const first = new Map(), seen = new Set(days[0].rows.map((r) => r[0])), perDay = new Map();
const eqRow = (sym, i) => (MK === 'in' ? uniqRows[i].rows[sym]?.[0] === 'EQ' && uniqRows[i].rows[sym][5] > 0 : true);   // as scripts/india-ipo-list.mjs: EQ series only
for (let i = 1; i < days.length; i++) { for (const r of days[i].rows) { const sym = r[0]; if (seen.has(sym)) continue; seen.add(sym); if (!eqRow(sym, i)) continue; first.set(sym, days[i].date); perDay.set(days[i].date, (perDay.get(days[i].date) ?? 0) + 1); } }
const renamed = new Set(); if (MK === 'in') for (const e of R('data/india/entities.json').entities) for (let i = 1; i < e.symbols.length; i++) renamed.add(e.symbols[i].symbol);
const ipo = [...first].filter(([s, d]) => perDay.get(d) <= 20 && !renamed.has(s)).map(([sym, listed]) => ({ sym, listed }));
const series = buildHistories(days, splits, new Set(ipo.map((x) => x.sym))).series;
const ck = Object.keys(compClose).sort(), ckIdx = new Map(ck.map((d, i) => [d, i]));
const compAt = (D) => { let lo = 0, hi = ck.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ck[m] <= D) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
const lightAt = (D) => { const a = compAt(D); if (a < 199) return 'yellow'; let s = 0, s50 = 0; for (let i = a - 199; i <= a; i++) { s += compClose[ck[i]]; if (i > a - 50) s50 += compClose[ck[i]]; } const up200 = compClose[ck[a]] >= s / 200, up50 = compClose[ck[a]] >= s50 / 50; return (LIGHT === 'both' ? up200 && up50 : up200) ? 'green' : 'red'; };
const bench63At = (D) => { const a = compAt(D); return a >= 63 ? compClose[ck[a]] / compClose[ck[a - 63]] - 1 : null; };

const [LF, LT] = arg('list', '2020-01-02:2022-12-31').split(':'), TAG = arg('tag', 'discovery');
const MINTV0 = Number(arg('mintv0', 0)), cohort = { total: 0, kept: 0 };
const dIdx = new Map(dates.map((d, i) => [d, i]));
const ma = (a, f, t) => { let s = 0, n = 0; for (let i = f; i <= t; i++) if (a[i] > 0) { s += a[i]; n++; } return n ? s / n : NaN; };
const events = [], none = [], all = [];
for (const { sym, listed } of ipo) {
  if (listed < LF || listed > LT) continue;
  const s = series.get(sym), t0 = dIdx.get(listed); if (!s || t0 == null) continue;
  cohort.total++; if (s.c[t0] * s.v[t0] < MINTV0) continue; cohort.kept++;
  const N = dates.length - 1, last = Math.min(N, t0 + 780);
  if (N - t0 < 250) continue;
  const c30 = s.c[t0 + 30]; if (!(c30 > 0)) continue;
  let peak = 0, peakAt = 0; for (let k = t0 + 30; k <= last; k++) if (s.c[k] > peak) { peak = s.c[k]; peakAt = k - t0; }
  const mult = peak / c30; all.push({ sym, listed, mult });
  // first big breakout
  let hh = -1, hhAt = 0, found = null;
  for (let k = t0 + 1; k < t0 + 400 && k < N - 1; k++) {
    const rel = k - t0;
    if (rel >= 20 && s.c[k] > hh && hh > 0) {
      const vol20 = ma(s.v, k - 20, k - 1), tv20 = ma(Float64Array.from({ length: 20 }, (_, j) => s.c[k - 20 + j] * s.v[k - 20 + j]), 0, 19);
      if (s.v[k] >= 2 * vol20 && tv20 >= 1e7) { found = k; break; }
    }
    if (s.h[k] > hh) { hh = s.h[k]; hhAt = k; }
  }
  if (found == null) { none.push({ sym, listed, mult }); continue; }
  const k = found, ent = uniqRows[k + 1]?.rows?.[sym]?.[2]; if (!(ent > 0)) { none.push({ sym, listed, mult, why: 'no entry open' }); continue; }
  let lo = Infinity; for (let j = hhAt; j <= k; j++) if (s.l[j] > 0 && s.l[j] < lo) lo = s.l[j];
  const fw = (n) => { const j = k + 1 + n; return j <= N && s.c[j] > 0 ? s.c[j] / ent - 1 : null; };
  let mdd = 0; for (let j = k + 1; j <= Math.min(N, k + 61); j++) if (s.l[j] > 0) mdd = Math.min(mdd, s.l[j] / ent - 1);
  let pk = 0; for (let j = k + 1; j <= Math.min(N, k + 1 + 520); j++) if (s.c[j] > pk) pk = s.c[j];
  let reach2 = false; for (let j = k + 1; j <= Math.min(N, k + 251); j++) if (s.c[j] >= 2 * ent) { reach2 = true; break; }
  const D = dates[k], a = compAt(D), b63 = bench63At(D), r63 = s.c[k - 63] > 0 ? s.c[k] / s.c[k - 63] - 1 : null;
  const ex = {}; for (const X of [0.25, 0.35, 0.5]) { let hi = ent, out = null, j = k + 1; for (; j <= Math.min(N - 1, k + 520); j++) { if (!(s.c[j] > 0)) continue; if (s.c[j] > hi) hi = s.c[j]; if (s.c[j] <= hi * (1 - X)) { const o = uniqRows[j + 1]?.rows?.[sym]?.[2]; out = o > 0 ? o : s.c[j]; break; } } if (out == null) { let m = Math.min(N, k + 521); while (m > k && !(s.c[m] > 0)) m--; out = s.c[m]; } ex[X] = { r: out / ent - 1 - 0.013, d: j - k }; }
  events.push({ ex, sym, listed, brk: D, rel: k - t0, vsList: s.c[k] / s.c[t0] - 1, vs30: k - t0 >= 30 ? s.c[k] / c30 - 1 : null, pop0: s.c[t0] / (uniqRows[t0].rows[sym][1] > 0 ? uniqRows[t0].rows[sym][1] : s.c[t0]) - 1, baseLen: k - hhAt, baseDepth: hh > 0 && lo < Infinity ? 1 - lo / hh : null, volX: s.v[k] / ma(s.v, k - 20, k - 1), rs63: r63 != null && b63 != null ? r63 - b63 : null, regime: lightAt(D), deliv: uniqRows[k].rows[sym]?.[7] ?? null, f60: fw(60), f120: fw(120), f250: fw(250), mdd60: mdd, peakFromEntry: pk / ent, reach2, mult, winner5: mult >= 5, winner10: mult >= 10, peakAt });
}
const q = (arr, p) => { const a = arr.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null; };
const rate = (e, f) => (e.length ? e.filter(f).length / e.length : null);
const pc = (x) => (x == null ? 'n/a' : (x * 100).toFixed(0) + '%');
const sum = { cohort, mintv0: MINTV0, sample: `${LF}..${LT}`, ipos: all.length, w3: all.filter((x) => x.mult >= 3 && x.mult < 5).length, w5: all.filter((x) => x.mult >= 5).length, w10: all.filter((x) => x.mult >= 10).length, noBreakout: none.length, noBreakoutWinners5: none.filter((x) => x.mult >= 5).length, firstBreakouts: events.length };
sum.precision5 = rate(events, (e) => e.winner5); sum.precision10 = rate(events, (e) => e.winner10); sum.reach2 = rate(events, (e) => e.reach2);
sum.f60med = q(events.map((e) => e.f60), 0.5); sum.f120med = q(events.map((e) => e.f120), 0.5); sum.f250med = q(events.map((e) => e.f250), 0.5);
const splits6 = {};
for (const key of ['rel', 'baseDepth', 'volX', 'rs63', 'pop0']) {
  const cut = q(events.map((e) => e[key]), 0.5), lo = events.filter((e) => e[key] != null && e[key] < cut), hi = events.filter((e) => e[key] != null && e[key] >= cut);
  splits6[key] = { cut, lowN: lo.length, highN: hi.length, lowReach2: rate(lo, (e) => e.reach2), highReach2: rate(hi, (e) => e.reach2), lowW5: rate(lo, (e) => e.winner5), highW5: rate(hi, (e) => e.winner5), lowF250: q(lo.map((e) => e.f250), 0.5), highF250: q(hi.map((e) => e.f250), 0.5) };
}
{ const g = events.filter((e) => e.regime === 'green'), r = events.filter((e) => e.regime !== 'green'); splits6.regime = { greenN: g.length, otherN: r.length, greenReach2: rate(g, (e) => e.reach2), otherReach2: rate(r, (e) => e.reach2), greenW5: rate(g, (e) => e.winner5), otherW5: rate(r, (e) => e.winner5), greenF250: q(g.map((e) => e.f250), 0.5), otherF250: q(r.map((e) => e.f250), 0.5) }; }
const trail = {}; for (const X of [0.25, 0.35, 0.5]) { const r = events.map((e) => e.ex[X].r), n = r.length, tot = r.reduce((a, x) => a + x, 0), srt = [...r].sort((a, b) => b - a), top = srt.slice(0, Math.max(1, Math.round(n * 0.1))).reduce((a, x) => a + x, 0); trail[X] = { n, mean: tot / n, median: q(r, 0.5), win: r.filter((x) => x > 0).length / n, topDecileShare: top / tot, hold: events.reduce((a, e) => a + e.ex[X].d, 0) / n, meanExBest: (tot - srt[0]) / (n - 1), best: srt[0] }; }
sum.trail = trail;
const winners = events.filter((e) => e.winner5).sort((a, b) => b.mult - a.mult);
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/IPO-WINNERS-${TAG}.json`, JSON.stringify({ sum, splits6, winners, events, none }, null, 0));
let md = `# IPO winners study — ${TAG} (${LF}..${LT})\n\nDefinitions: docs/replay/IPO-WINNERS-PREREG.md. Descriptive. Paper only.\n\n## Counts\n\n` + Object.entries(sum).map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' && v < 1 && v > 0 ? pc(v) : v}`).join('\n');
md += `\n\n## Single-feature splits at the sample median (precision across all first breakouts)\n\n| feature | cut | low n | high n | low 2x-in-250 | high 2x-in-250 | low 5x | high 5x |\n|---|---|---|---|---|---|---|---|\n`;
for (const k of ['rel', 'baseDepth', 'volX', 'rs63', 'pop0']) { const x = splits6[k]; md += `| ${k} | ${x.cut?.toFixed(2)} | ${x.lowN} | ${x.highN} | ${pc(x.lowReach2)} | ${pc(x.highReach2)} | ${pc(x.lowW5)} | ${pc(x.highW5)} |\n`; }
{ const x = splits6.regime; md += `| regime green vs other | - | ${x.greenN} | ${x.otherN} | ${pc(x.greenReach2)} | ${pc(x.otherReach2)} | ${pc(x.greenW5)} | ${pc(x.otherW5)} |\n`; }
md += `\n## 5x+ winners and their first breakout\n\n| symbol | listed | first breakout | sessions after listing | vs listing close | base days | base depth | vol x | RS63 | regime | peak x (from s30) | peak from entry | 250s fwd | 60s max dd |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const e of winners) md += `| ${e.sym} | ${e.listed} | ${e.brk} | ${e.rel} | ${pc(e.vsList)} | ${e.baseLen} | ${pc(e.baseDepth)} | ${e.volX.toFixed(1)} | ${pc(e.rs63)} | ${e.regime} | ${e.mult.toFixed(1)} | ${e.peakFromEntry.toFixed(1)} | ${pc(e.f250)} | ${pc(e.mdd60)} |\n`;
md += `\n## Trailing exits (addendum 2)\n\n| trail | trades | mean net | median net | winners | top-10% share of profit | mean hold (sessions) | mean ex best | best |\n|---|---|---|---|---|---|---|---|---|\n` + Object.entries(trail).map(([x, t]) => `| ${x} | ${t.n} | ${pc(t.mean)} | ${pc(t.median)} | ${pc(t.win)} | ${pc(t.topDecileShare)} | ${t.hold.toFixed(0)} | ${pc(t.meanExBest)} | ${pc(t.best)} |`).join('\n') + '\n';
const nw = all.filter((x) => x.mult >= 5 && !events.find((e) => e.sym === x.sym)); if (nw.length) md += `\n5x+ winners with no qualifying first breakout: ${nw.map((x) => x.sym + ' ' + x.mult.toFixed(1) + 'x').join(', ')}\n`;
writeFileSync(`${OUT}/IPO-WINNERS-${TAG}.md`, md);
console.log(md.slice(0, 6000));
