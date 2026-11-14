// Batch A replay (decision D8, claude/batch-a-fundamentals-rules-draft.md): one registered run per book (A1, A2, A3, A5, A6) over the stored price and filing history, with the rules exactly as built for the live books
// (src/engine/batch-a.ts, src/engine/fundamentals-asof.ts, src/engine/stock-book.ts). No tuning. Paper only.
// Method: each session t from --from, the book steps with the same stepBook as the live runner (signal at the close, fill at the next open, tier costs, stops).
// Company figures are rebuilt as of each session: for every top-500 name at each month's first session, and for any name whose filing was broadcast that day (the A1 signal day). Between those days a name keeps its last figures.
// Known limits, printed in every report: (1) the top-500 list is rebuilt monthly and held for the month; (2) cash earns nothing in the replay (the live books credit the liquid-fund rate); (3) the Nifty 500 is the comparator for all five (the Value 50 fund has no record before May 2023);
// (4) prices 2020 to 2026 have been seen in other tests; (5) filings may be missing for companies delisted since (data/india/survivorship-filings.json).
// Usage: node --max-old-space-size=7000 scripts/replay-batch-a.mjs [--book=A1,A2,...,B1,B2,B3] [--from=2021-01-01] [--to=YYYY-MM-DD] [--out=docs/replay] [--smoke]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE, tierCost } from '../src/backtest/ind-base.ts';
import { newBook, stepBook, monthlyValues } from '../src/engine/stock-book.ts';
import { isMonthStart } from '../src/engine/first-wave.ts';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures } from '../src/engine/fundamentals-asof.ts';
import { valueLite, qualityLite, fallen, compounder, pead } from '../src/engine/batch-a.ts';
import { magic, piotroski, fullQuality, piotroskiScore, LIQUID_BASIS } from '../src/engine/batch-b.ts';
import { scorecard } from '../src/engine/scorecard.ts';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const FROM = arg('from', '2021-01-01'), TO = arg('to', '9999-12-31'), OUT = arg('out', 'docs/replay'), SMOKE = process.argv.includes('--smoke');
const BOOKS = { A1: { id: 'ba-a1-pead', name: 'Post-earnings drift', fn: pead }, A2: { id: 'ba-a2-value', name: 'Value-lite', fn: valueLite }, A3: { id: 'ba-a3-quality', name: 'Quality-lite', fn: qualityLite }, A5: { id: 'ba-a5-fallen', name: 'Fallen and rebuilding', fn: fallen }, A6: { id: 'ba-a6-compounder', name: 'Consistent compounder, lite', fn: compounder } , B1: { id: 'bb-b1-magic', name: 'Magic Formula', fn: magic, batch: 'B', need: (f) => !f.financial && f.bs?.liquidBasis === LIQUID_BASIS && f.ttm.operatingEbit != null && f.enterpriseValue != null && f.returnOnCapital != null }, B2: { id: 'bb-b2-piotroski', name: 'Piotroski F-score', fn: piotroski, batch: 'B', need: (f) => !f.financial && f.marketCap != null && f.fy?.cur.equity != null && piotroskiScore(f) != null }, B3: { id: 'bb-b3-fullquality', name: 'Full quality', fn: fullQuality, batch: 'B', need: (f) => !f.financial && f.bs?.liquidBasis === LIQUID_BASIS && f.ttm.operatingEbit != null && f.netDebt != null && f.returnOnCapital != null && f.cashFlowFy[0]?.cfo != null && f.bs?.assets != null && f.margin.operatingEbit != null && f.growth.revenueCagr3 != null && f.quarterlyEbitMargin.length >= 12 && f.quarterlyEbitMargin.filter((v) => v != null).length >= 10 } };
const WANT = arg('book', 'A1,A2,A3,A5,A6').split(',').map((s) => s.trim()).filter((s) => BOOKS[s]);
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
BASE.universe = 500;

const raw = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
raw.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
const actions = [...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date);
const industry = R('data/india/segments.json', {}).industry ?? {}, names = R('data/names.json', { india: {} }).india ?? {}, allowed = new Set(Object.keys(industry));
for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const isCo = (sym) => sym in industry || sym in names;
const FH = buildHistories(days, res.splits, allowed), series = FH.series;
const ents = R('data/india/entities.json').entities, bySym = new Map();
for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push([u, e]); bySym.set(u.symbol, a); }
const entityOf = (sym, D) => { const a = bySym.get(sym); if (!a) return null; return (a.find(([u]) => (u.from == null || u.from <= D) && (u.to == null || u.to >= D)) || a[a.length - 1])[1]; };
const splitsOf = new Map(); for (const [sym, date, factor] of res.splits) { const a = splitsOf.get(sym) || []; a.push({ date, factor }); splitsOf.set(sym, a); }
const stores = new Map();   // entity id -> {facts, days:Set}
const storeOf = (e) => { if (stores.has(e.id)) return stores.get(e.id); const p = `data/india/filings/${e.id}.json.gz`; let o = null;
  if (existsSync(p)) { const s = JSON.parse(gunzipSync(readFileSync(p))); const facts = s.results.filter((y) => y.asOf).map((y) => ({ entity: e.id, period: y.period, basis: y.basis, asOf: y.asOf, revision: y.revision ?? 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra })); o = { facts, days: new Set(facts.filter((f) => !f.revision).map((f) => f.asOf.slice(0, 10))) }; }
  stores.set(e.id, o); return o; };

let t0 = dates.findIndex((d) => d >= FROM); if (t0 < 1) t0 = 1; let t1 = dates.length - 1; while (t1 > t0 && dates[t1] > TO) t1--;
const rowsNow = {}, entNow = {};   // sym -> features
const featuresFor = (sym, D, t) => { const e = entityOf(sym, D); if (!e) return null; const st = storeOf(e); if (!st) return null;
  const view = asOfResults(st.facts, e.id, D, { limit: 40, events: e.events }); const close = days[t].rows.find ? null : null; void close;
  const r = rawRow(sym, t); return computeFeatures(view, r, (splitsOf.get(sym) ?? []).filter((s) => s.date <= D)); };
const rawIdx = days.map((d) => { const m = new Map(); for (const r of d.rows) m.set(r[0], r); return m; });
const rawRow = (sym, t) => rawIdx[t].get(sym)?.[1] ?? null;   // unadjusted close that night
const openAt = (sym, t) => { const r = uniq[t]?.rows?.[sym]; return r && r[2] > 0 ? r[2] : NaN; };
const ageAt = (sym, t) => { const s = series.get(sym); if (!s) return 0; for (let k = t; k >= Math.max(0, t - 30); k--) if (s.c[k] > 0) return t - k; return 31; };
const pxAt = (sym, t) => { const s = series.get(sym); if (!s) return NaN; for (let k = t; k >= Math.max(0, t - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };

const idx = (() => { const o = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) o[d] = v[3]; } return o; })();
const idxDates = Object.keys(idx).sort(), n500At = (d) => { let lo = 0, hi = idxDates.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (idxDates[m] <= d) { a = m; lo = m + 1; } else hi = m - 1; } return a >= 0 ? idx[idxDates[a]] : null; };

const states = Object.fromEntries(WANT.filter((k) => !BOOKS[k].batch).map((k) => [k, newBook(BOOKS[k].id, FROM)])), window = Object.fromEntries(WANT.filter((k) => BOOKS[k].batch).map((k) => [k, { start: null, months: [] }])), wide = Object.fromEntries(WANT.map((k) => [k, []])), plog = Object.fromEntries(WANT.map((k) => [k, []]));
const exposure = Object.fromEntries(WANT.map((k) => [k, { sum: 0, n: 0 }]));
let el500 = [], elMonth = '', unranked = 0;
const t00 = Date.now();
for (let t = t0; t <= t1; t++) {
  const D = dates[t], monthStart = isMonthStart(dates, t);
  if (monthStart || !el500.length) {
    const hist = asOfHistories(days.slice(0, t + 1), t, res, allowed);
    el500 = eligible(hist, t, BASE.skip).filter((p) => isCo(p.sym)).map((p) => ({ sym: p.sym, value: p.value })); elMonth = D.slice(0, 7);
    for (const n of el500) { const f = featuresFor(n.sym, D, t); if (f) rowsNow[n.sym] = f; else delete rowsNow[n.sym]; }
    unranked = el500.filter((n) => !rowsNow[n.sym]).length;
  } else {
    for (const n of el500) { const e = entityOf(n.sym, D); const st = e && storeOf(e); if (st && st.days.has(D)) { const f = featuresFor(n.sym, D, t); if (f) rowsNow[n.sym] = f; } }   // a filing was broadcast tonight: refresh that name
  }
  if (monthStart) for (const k of WANT) { const b = BOOKS[k]; if (!b.batch) continue;   // Batch B window rule (fixed before any run): a month counts once 90% of eligible non-financial names carry every figure the book needs; the book starts at the first such month
    const nf = el500.map((n) => rowsNow[n.sym]).filter((f) => f && !f.financial), ok = nf.filter(b.need).length, cov = nf.length ? ok / nf.length : 0;
    window[k].months.push({ m: D.slice(0, 7), eligible: nf.length, covered: ok, share: Math.round(cov * 1e4) / 1e4 });
    if (!states[k] && cov >= 0.9) { states[k] = newBook(b.id, D); window[k].start = D; } }
  for (const k of WANT) {
    const st = states[k], b = BOOKS[k]; if (!st) continue;
    const signal = (held, stx) => b.fn({ el: el500, series, t, dates, held, fund: rowsNow, st: stx, group: (sym) => industry[sym] ?? null }, ...(k === 'A1' ? [wide[k], plog[k]] : []));
    stepBook(st, { D, open: (s) => openAt(s, t), age: (s) => ageAt(s, t), close: (s) => pxAt(s, t), cashRet: null, tier: (v) => tierCost(v), signal });
    const v = st.daily.at(-1)?.v ?? null; if (v) { const posV = Object.values(st.pos).reduce((a, p) => a + p.sh * (pxAt(Object.keys(st.pos).find((s) => st.pos[s] === p), t) || p.entry), 0); exposure[k].sum += posV / v; exposure[k].n++; }
  }
  if (SMOKE && (t - t0) % 60 === 0) console.log(D, `ey=${Object.values(rowsNow).filter((r) => r.earningsYield != null).length} ttm=${Object.values(rowsNow).filter((r) => r.ttm.pat != null).length}`, `el500=${el500.length}`, WANT.map((k) => `${k}:${Object.keys(states[k].pos).length}`).join(' '), `${Math.round((Date.now() - t00) / 1000)}s`);
}
const surv = R('data/india/survivorship-filings.json');
const pct = (x) => (x == null ? 'n/a' : (x * 100).toFixed(1) + '%');
const summary = {};
for (const k of WANT) {
  if (!states[k]) { summary[k] = { name: BOOKS[k].name, months: 0, sinceStart: null, confidence: null, drawdown: null, closedTrades: 0, stopOuts: 0, avgExposure: null, byYear: {}, window: window[k] }; continue; }
  const st = states[k], bm = monthlyValues(st), n500M = bm.map((x) => ({ m: x.m, v: n500At(x.d) })).filter((x) => x.v > 0);
  const trades = st.closed.map((c) => c.ret - tierCost(st.lastValue[c.sym] ?? 0)), tr = { n: trades.length, avg: trades.length ? trades.reduce((a, x) => a + x, 0) / trades.length : null };
  const sc = bm.length ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), n500M, tr, 0) : null;
  const byYear = {}; for (let i = 1; i < bm.length; i++) { const y = bm[i].m.slice(0, 4); const a = byYear[y] ??= { book: 1, comp: 1 }; a.book *= bm[i].v / bm[i - 1].v; const c1 = n500M.find((x) => x.m === bm[i].m)?.v, c0 = n500M.find((x) => x.m === bm[i - 1].m)?.v; if (c1 > 0 && c0 > 0) a.comp *= c1 / c0; }
  summary[k] = { name: BOOKS[k].name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, confidence: sc ? sc.confidence.confidence : null, drawdown: sc?.drawdown ?? null, closedTrades: st.closed.length, avgNetTrade: tr.avg, stopOuts: st.closed.filter((c) => c.why === 'stop').length, avgExposure: exposure[k].n ? exposure[k].sum / exposure[k].n : null, byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { book: a.book - 1, comp: a.comp - 1, excess: a.book - a.comp }])), skippedWide: st.skipped?.length ?? 0, signals: k === 'A1' ? plog[k].length : null, signalsNoSlot: k === 'A1' ? plog[k].filter((x) => x.why === 'no slot').length : null, firstValue: bm[0]?.m ?? null };
}
for (const k of WANT) if (window[k] && summary[k]) summary[k].window = window[k];
const KIND = WANT.every((k) => BOOKS[k].batch === 'B') ? 'B' : 'A';
const stamp = new Date().toISOString().slice(0, 10), out = { run: stamp, from: FROM, to: dates[t1], universe: 'top 500, rebuilt monthly', unrankedLastMonth: unranked, summary, survivorship: surv?.byYear ?? null, stillTradingShare: surv?.stillTrading?.share ?? null };
if (SMOKE) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/BATCH-${KIND}-REPLAY.json`, JSON.stringify(out, null, 1));
const L = [`# Batch ${KIND} replay (decision D8)`, ``, `Run ${stamp}, sessions ${FROM} to ${dates[t1]}. One registered run per book, rules as built, no tuning. Paper only; not a financial adviser.`, ``,
  `**Labels on every result.** (1) The 2020 to 2026 price period has been seen in other tests (C-59 to C-62 saw the results-day reactions of 2024 to 2026): not a clean out-of-sample read. (2) Survivor bias: filings exist for ${pct(surv?.stillTrading?.share)} of liquid names still trading but only ${Object.entries(surv?.byYear ?? {}).map(([y, b]) => `${y} ${pct(b.share)}`).join(', ')} of liquid names that later vanished (by the year last seen), so names that disappeared are under-represented and results lean favourable. (3) Cash earns nothing here (live books credit the liquid-fund rate); the top-500 list is rebuilt monthly; the comparator is the Nifty 500 for all five (price index, no dividends, so it is slightly harsh on the comparator side).`, ``,
  `| Book | Months | Book since start | Nifty 500 since start | Excess | Confidence | Max drawdown | Closed trades | Stop-outs | Avg exposure |`, `|---|---|---|---|---|---|---|---|---|---|`];
for (const k of WANT) { const s = summary[k]; L.push(`| ${k} ${s.name} | ${s.months} | ${pct(s.sinceStart?.book)} | ${pct(s.sinceStart?.comp)} | ${pct(s.sinceStart?.excess)} | ${s.confidence == null ? 'n/a' : s.confidence.toFixed(2)} | ${pct(s.drawdown)} | ${s.closedTrades} | ${s.stopOuts} | ${pct(s.avgExposure)} |`); }
L.push(``, `## Calendar years (book return, Nifty 500 return, ratio of growth)`, ``);
for (const k of WANT) { L.push(`**${k} ${summary[k].name}:** ` + Object.entries(summary[k].byYear).map(([y, a]) => `${y}: ${pct(a.book)} vs ${pct(a.comp)}`).join('; ')); L.push(``); }
if (summary.A1) L.push(`A1 signals logged: ${summary.A1.signals}, skipped for no free slot: ${summary.A1.signalsNoSlot}.`, ``);
if (KIND === 'B') { L.push(`## Window (rule fixed before the run)`, ``, `A month counts once at least 90% of eligible non-financial names in that month's top 500 carry every figure the book needs; the book starts at the first such month. **This run is an implementation check, not evidence:** the window is short and sits in one market phase, and balance sheets before Sep 2022 do not exist in the source.`, ``);
  for (const k of WANT) { const w = window[k]; L.push(`**${k} ${BOOKS[k].name}:** ${w.start ? 'started ' + w.start : 'never reached 90% coverage'}; coverage by month: ` + w.months.map((x) => `${x.m} ${(x.share * 100).toFixed(0)}%`).join(', ')); L.push(``); } }
L.push(`Forward paper stays the primary evidence. This table shows what the rules would have done, not what they will do.`);
writeFileSync(`${OUT}/BATCH-${KIND}-REPLAY.md`, L.join('\n') + '\n'); console.log(L.join('\n'));
