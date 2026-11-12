// Nightly MOM-30 v1 momentum sleeve, US (Engine Rules C-131 step 2): paper only, comparison only, no orders, no alerts. The India job is scripts/momentum-sleeve.mjs.
// Writes data/us/momentum-sleeve/latest.json (tonight's ranks, the list and its status), state.json (the paper book) and reads settings/strategies.json.
// The book changes only on review dates (first session of June and December) and once at the start: signal on the first session's close, simulated fill at the next session's open (C-139; C-130 and C-131 were registered at the next close).
// Usage: node --max-old-space-size=6000 scripts/momentum-sleeve-us.mjs [--asof=YYYY-MM-DD] [--dry]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { usCost } from '../src/backtest/us-loader.ts';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { resultsAvoid } from '../src/ingest/earnings.ts';
import { MOM30, selectSleeve, sleeveWeights, isReviewSession, MONTHLY, eligibleUs, goneNames } from '../src/engine/momentum-sleeve.ts';
import { applyFilter } from '../src/engine/sleeve-filters.ts';
import { loadDays } from './us-hist-lib.mjs';
import { gunzipSync } from 'node:zlib';
import { writeStockHist } from './stock-hist-lib.mjs';

const ASOF = process.argv.find((a) => a.startsWith('--asof='))?.slice(7), DRY = process.argv.includes('--dry');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const strat = (R('settings/strategies.json', { strategies: [] }).strategies || []).find((s) => s.id === 'mom30-us');
if (!strat) { console.error('settings/strategies.json has no mom30-us entry'); process.exit(1); }
const START_AFTER = process.env.MOM_START || strat.startAfter;

const tf = readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop(), tk = R('data/us/' + tf), allowed = new Set(tk.rows.filter(([, ty]) => ty === 'CS' || ty === 'ADRC').map(([sym]) => sym));
const days = loadDays(ASOF).map((d) => ({ date: d.date, rows: d.rows.filter((r) => allowed.has(r[0])) })), dates = days.map((d) => d.date), t = days.length - 1, D = dates[t];
const FH = buildHistories(days, [], allowed), series = FH.series, names = R('data/names.json', { us: {} }).us ?? {};
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const ret = (sym, w) => { const s = series.get(sym); return s && s.c[t] > 0 && s.c[t - w] > 0 ? s.c[t] / s.c[t - w] - 1 : null; };

// C-139: paper books fill at the next session's open. US opens come from data/us/open/<date>.json.gz (written by us-hist-update); a name with no stored open falls back to its close and is counted.
const OPEN = (() => { const f = `data/us/open/${D}.json.gz`; if (!existsSync(f)) return {}; try { return JSON.parse(gunzipSync(readFileSync(f))).open ?? {}; } catch { return {}; } })();
const openOn = (d) => { const f = `data/us/open/${d}.json.gz`; if (!existsSync(f)) return {}; try { return JSON.parse(gunzipSync(readFileSync(f))).open ?? {}; } catch { return {}; } };   // opens by date, for each holding's entry price (the open it was bought at)
// Stop twin (C-147): MOM_STOP=0.25 runs the same book with a trailing stop on each name (sold at the next open once a close is that far below its highest close since bought; not replaced until the next review). Unset, the book has no stop and is unchanged.
const STOP = Number(process.env.MOM_STOP) || 0;
const MONTHLY_TWIN = process.env.MOM_REVIEW === 'monthly', RM = MONTHLY_TWIN ? MONTHLY : undefined;   // C-151: a twin re-ranked every month (same fills as the registered book at the start)

// C-155 results rule: a name with results within 10 sessions is not newly bought at a review (the next-ranked name takes its place); names already held are untouched.
// Source: data/us/scan/results-calendar.json, written by scan-earnings earlier tonight. Missing or not from tonight: the rule cannot act and says so.
const RES = (() => { const c = R('data/us/scan/results-calendar.json'), cj = loadCalendarFiles(), cal = makeCalendar([...(cj['us']?.holidays ?? []), ...(cj['us']?.priorHolidays ?? [])]);
  if (!c || c.asOf !== D) return { avoid: new Set(), source: c ? `calendar from ${c.asOf}, not tonight: rule not applied` : 'no calendar: rule not applied', names: 0 };
  const avoid = resultsAvoid(c.dates, D, cal.sessionsBetween.bind(cal)); return { avoid, source: `calendar ${c.asOf}`, names: Object.keys(c.dates).length }; })();
let goneSet = new Set();   // names with no close for GONE_SESSIONS sessions tonight (C-190): no price, so never bought and sold only at the last close, below
const fbClose = new Set(); const fp = (sym) => { if (goneSet.has(sym)) return NaN; const o = OPEN[sym]; if (o > 0) return o; fbClose.add(sym); return px(sym, t); };
const dir = process.env.MOM_DIR || 'data/us/momentum-sleeve', stFile = dir + '/state.json';
const st = R(stFile, { version: MOM30.version, startAfter: START_AFTER, book: null, pending: null, lastSignal: null, reviews: [], daily: [], monthly: {} });
const held = () => new Set(Object.keys(st.book?.shares ?? {}));
const valueAt = (f) => { let v = st.book.cash; for (const [sym, sh] of Object.entries(st.book.shares)) { const p = f(sym); v += sh * (p > 0 ? p : 0); } return v; };
const value = (i) => { let v = st.book.cash; for (const [sym, sh] of Object.entries(st.book.shares)) { const p = px(sym, i); v += sh * (p > 0 ? p : 0); } return v; };

// 0) C-190: a held name with no close for 5 sessions is sold at its last close (delisted, acquired, suspended), before any fill; the same rule as the stock books.
if (st.book) {
  const gone = goneNames(Object.keys(st.book.shares), series, t); goneSet = new Set(gone); st.gone ??= [];
  for (const sym of gone) { const sh = st.book.shares[sym], p = px(sym, t); if (!(sh > 0)) continue; const gross = sh > 0 && p > 0 ? sh * p : 0, ent = st.book.entry?.[sym];
    st.book.cash += gross - gross * usCost(st.book.lastValue?.[sym] ?? 0) / 2; st.gone.push({ sym, date: D, price: p > 0 ? Math.round(p * 100) / 100 : null, entry: ent ?? null, ret: ent > 0 && p > 0 ? Math.round((p / ent - 1) * 1e4) / 1e4 : null });
    delete st.book.shares[sym]; delete st.book.entry?.[sym]; delete st.book.high?.[sym]; }
  if (gone.length && st.stopQueue) st.stopQueue = st.stopQueue.filter((q) => !gone.includes(q.sym));
}
// 1) fill a pending rebalance at tonight's open (the session after the signal; C-139)
if (STOP) st.stops ??= [];
if (STOP && st.book && st.stopQueue?.some((q) => q.on < D) && !(st.pending && D > st.pending.signalDate)) {   // a stop queued on a close is sold at a LATER session's open, never the same day's
  for (const q of st.stopQueue.filter((q) => q.on < D)) { const sh = st.book.shares[q.sym], p = fp(q.sym); if (!(sh > 0) || !(p > 0)) continue; const gross = sh * p, ent = st.book.entry?.[q.sym]; st.book.cash += gross - gross * usCost(st.book.lastValue[q.sym] ?? 0) / 2; st.stops.push({ sym: q.sym, signalDate: q.on, fillDate: D, entry: ent ?? null, price: Math.round(p * 100) / 100, ret: ent > 0 ? Math.round((p / ent - 1) * 1e4) / 1e4 : null }); delete st.book.shares[q.sym]; delete st.book.entry?.[q.sym]; delete st.book.high?.[q.sym]; }
  st.stopQueue = st.stopQueue.filter((q) => !(q.on < D));
}
if (st.pending && D > st.pending.signalDate) {
  const first = !st.book, V = first ? 100 : valueAt(fp), tgt = new Map(st.pending.target.map((x) => [x.sym, x.w * V]));
  const cur = first ? new Map() : new Map(Object.entries(st.book.shares).map(([s, n]) => [s, n * (fp(s) > 0 ? fp(s) : 0)]));
  const lastValue = { ...(st.book?.lastValue ?? {}), ...st.pending.values };
  let traded = 0, cost = 0; for (const sym of new Set([...cur.keys(), ...tgt.keys()])) { if (!(fp(sym) > 0)) continue; const d = Math.abs((tgt.get(sym) ?? 0) - (cur.get(sym) ?? 0)); traded += d; cost += d * usCost(lastValue[sym] ?? 0) / 2; }
  const V2 = V - cost, shares = {}; let cash = 0;
  for (const [sym, amt] of tgt) { const p = fp(sym); if (p > 0) shares[sym] = (amt / V) * V2 / p; else cash += (amt / V) * V2; }
  const before = first ? [] : Object.keys(st.book.shares), after = Object.keys(shares);
  st.reviews.push({ signalDate: st.pending.signalDate, fillDate: D, fillBasis: fbClose.size ? `open, ${fbClose.size} name(s) at the close (no open stored)` : 'open', closeFallbacks: [...fbClose], count: after.length, entered: after.filter((s) => !before.includes(s)), left: before.filter((s) => !after.includes(s)), turnoverPct: Math.round(traded / (2 * V) * 1000) / 10, costPct: Math.round(cost / V * 10000) / 100, check: st.pending.check });
  const entry = Object.fromEntries(after.map((s) => [s, st.book?.entry?.[s] ?? (fp(s) > 0 ? fp(s) : null)]));   // price paid per share: kept for names held through a review, the fill open for new ones
  const high = Object.fromEntries(after.map((s) => [s, st.book?.high?.[s] ?? (fp(s) > 0 ? fp(s) : null)]));
  st.book = { cash, shares, lastValue, entry, ...(STOP ? { high } : {}), startedFill: st.book?.startedFill ?? D }; st.pending = null; st.stopQueue = [];
}
if (st.book && !st.book.entry) { const o = openOn(st.book.startedFill); st.book.entry = Object.fromEntries(Object.keys(st.book.shares).map((s) => [s, o[s] > 0 ? o[s] : null])); }   // books filled before entry prices were stored
// 2) mark the book
if (st.book && (!st.daily.length || st.daily.at(-1).d < D)) { const v = value(t); st.daily.push({ d: D, v: Math.round(v * 1e4) / 1e4 }); st.monthly[D.slice(0, 7)] = { d: D, v: Math.round(v * 1e4) / 1e4 }; }
if (STOP && st.book && st.stopChecked !== D) {   // stop check on tonight's close: queue a sale at the next open
  st.stopChecked = D; st.stopQueue ??= []; st.book.high ??= {};
  for (const sym of Object.keys(st.book.shares)) { const c = px(sym, t); if (!(c > 0)) continue; st.book.high[sym] = Math.max(st.book.high[sym] ?? st.book.entry?.[sym] ?? 0, c); if (c <= (1 - STOP) * st.book.high[sym] && !st.stopQueue.some((q) => q.sym === sym)) st.stopQueue.push({ sym, on: D }); }
}
// 3) signal tonight?  First ever run after the start date, or the first session of a review month.
// Pool filter for the stopped-parent variants (MOM_FILTER=lowturn|max|template; C-182, C-188, C-185): applied to the eligible top 200, the sleeve rule then runs unchanged.
const FILTER = process.env.MOM_FILTER || '', el = FILTER ? applyFilter(FILTER, eligibleUs(series, t).slice(0, MOM30.UNI), series, t) : eligibleUs(series, t);
const preview = selectSleeve(el, series, t, held(), RES.avoid), wts = sleeveWeights(preview);
const needFirst = !st.book && !st.pending && D > START_AFTER;
if (!st.pending && st.lastSignal !== D && D > START_AFTER && (needFirst || (st.book && isReviewSession(dates, t, RM)))) {
  // the US store has one data path (prices already split-adjusted), so there is no second path to compare; the check is recorded as not applicable
  st.pending = { signalDate: D, resultsRule: { rule: 'C-155', source: RES.source, inWindow: RES.avoid.size, skipped: preview.ranked.filter((r) => RES.avoid.has(r.sym) && !held().has(r.sym) && r.rank <= MOM30.KEEP).map((r) => r.sym) }, target: preview.picks.map((p, i) => ({ sym: p.sym, w: wts[i] })), values: Object.fromEntries(el.map((e) => [e.sym, e.value])), check: { sameNames: null, maxWeightDiffPp: null, pass: null, note: 'one US data path; no second path to compare' } };
  st.lastSignal = D;
}
// 4) tonight's list for the page
const hs = held(), tgtW = st.pending ? new Map(st.pending.target.map((x) => [x.sym, x.w])) : null, book = st.book ? value(t) : null;
const status = (r) => (hs.size ? (hs.has(r.sym) ? (r.rank <= MOM30.HOLD ? 'Held' : r.rank <= MOM30.KEEP ? 'In buffer' : 'Would leave') : r.rank <= MOM30.HOLD ? 'Would enter' : '') : r.rank <= MOM30.HOLD ? 'Preview' : '');
const wNow = (sym) => (st.book && book > 0 ? (st.book.shares[sym] ?? 0) * (px(sym, t) > 0 ? px(sym, t) : 0) / book : null);
const prevW = new Map(preview.picks.map((p, i) => [p.sym, wts[i]]));
const top = preview.ranked.slice(0, 60);
const heldNotTop = [...hs].filter((s) => !top.some((r) => r.sym === s)).map((s) => preview.ranked.find((r) => r.sym === s) ?? { sym: s, rank: null, s: null, mult: null, value: 0 });
const rows = [...top, ...heldNotTop].map((r) => ({ rank: r.rank, sym: r.sym, name: names[r.sym] ?? null, score: r.s === null ? null : Math.round(r.s * 100) / 100, weightNow: wNow(r.sym) === null ? null : Math.round(wNow(r.sym) * 1e4) / 1e4, weightTarget: Math.round((prevW.get(r.sym) ?? 0) * 1e4) / 1e4, status: status(r), r6: ret(r.sym, 126), r12: ret(r.sym, 252), ...(st.book?.shares[r.sym] ? { entry: st.book.entry?.[r.sym] ?? null, last: px(r.sym, t) > 0 ? Math.round(px(r.sym, t) * 100) / 100 : null, sinceEntry: st.book.entry?.[r.sym] > 0 && px(r.sym, t) > 0 ? Math.round((px(r.sym, t) / st.book.entry[r.sym] - 1) * 1e4) / 1e4 : null } : {}) }));
const nextRev = MONTHLY_TWIN ? (() => { const [y, m] = D.split('-').map(Number); const n = m === 12 ? [y + 1, 1] : [y, m + 1]; return `${n[0]}-${String(n[1]).padStart(2, '0')}`; })() : (() => { const [y, m] = D.split('-').map(Number); const c = [[y, 6], [y, 12], [y + 1, 6]].find(([yy, mm]) => yy * 12 + mm > y * 12 + m); return `${c[0]}-${String(c[1]).padStart(2, '0')}`; })();
// monthly comparison lines: the sleeve, SPY and QQQ (price only), rebased to the first month-end after the first fill
const bench = (sym) => { const bars = JSON.parse(gunzipSync(readFileSync(`data/us/hist-bench/${sym}.json.gz`)).toString()).bars; return new Map(bars.map((b) => [b[0], b[1]])); };
const spyM = bench('SPY'), qqqM = bench('QQQ'), months = Object.keys(st.monthly).sort();
const origin = months.find((m) => st.book && st.monthly[m].d >= st.book.startedFill && st.monthly[m].d.slice(0, 7) !== st.book.startedFill.slice(0, 7)) ?? null;
const line = (f) => { if (!origin) return null; const base = f(origin); if (!(base > 0)) return null; return months.filter((m) => m >= origin).map((m) => { const v = f(m); return v > 0 ? { m, x: Math.round(v / base * 1e4) / 100 } : { m, x: null }; }); };
const board = origin ? { origin, lines: { sleeve: line((m) => st.monthly[m]?.v), spy: line((m) => spyM.get(st.monthly[m]?.d)), qqq: line((m) => qqqM.get(st.monthly[m]?.d)) } } : null;
const rep = R('data/replay/c131-momentum30-us.json', {}), w0 = (rep.windows ?? [])[0];
const out = {
  version: MOM30.version, asOf: D, startAfter: START_AFTER, universe: preview.universe, nextReview: nextRev, lastBuild: st.reviews.at(-1)?.fillDate ?? null,
  state: st.book ? 'running' : st.pending ? 'pending fill' : 'waiting', pending: st.pending ? { signalDate: st.pending.signalDate, check: st.pending.check } : null,
  heldCount: hs.size, valueIndex: book === null ? null : Math.round(book * 100) / 100, sinceFill: st.book && st.daily.length ? Math.round((book / 100 - 1) * 1e4) / 100 : null,
  rows, reviews: st.reviews, daily: st.daily.slice(-400), board, replication: null, replay: w0 ? { rule: 'C-131', verdict: w0.pass ? 'pass' : 'fail', sleeve: w0.vsSPY.sleeve, spy: w0.vsSPY.index, window: w0.label, note: 'survivor-biased data: delisted stocks missing' } : null, comparisonOnly: true,
  wouldEnter: rows.filter((r) => r.status === 'Would enter').map((r) => r.sym), wouldLeave: rows.filter((r) => r.status === 'Would leave').map((r) => r.sym),
};
out.gone = st.gone ?? [];
if (MONTHLY_TWIN) out.reviewRule = 'monthly';
if (STOP) { out.stopRule = STOP; out.stops = st.stops ?? []; out.stopQueue = (st.stopQueue ?? []).map((q) => q.sym); }
if (process.env.DBG) console.log(rows.slice(0, 45).map((r) => `${r.rank} ${r.sym} ${r.score} ${(names[r.sym] ?? "").slice(0, 28)}`).join("\n"));
console.log(JSON.stringify({ asOf: D, state: out.state, universe: out.universe, held: out.heldCount, pending: out.pending, reviews: st.reviews.length, top3: rows.slice(0, 3).map((r) => r.sym) }));
if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(out) + '\n'); }
if (!process.env.MOM_DIR && !ASOF) { const n = writeStockHist({ series, dates, t, file: 'data/us/momentum-sleeve/stock-hist.json' }); console.log('stock history for charts: ' + n + ' names'); }   // chart data for the Strategies page, written by the registered run only
