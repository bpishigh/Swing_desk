// Nightly first-wave paper books, US versions (Engine Rules C-179 shared terms; C-181, C-183, C-184). Paper only: no orders, no alerts. Confirmation market (C-179): a US result alone adopts nothing.
// Reads settings/first-wave-books-us.json; for each book writes data/us/books/<id>/state.json and latest.json. Signal on the close, fill at the next session's open (C-139).
// US inputs: bars from the Nasdaq-sourced store (split-adjusted, no dividends), opens from data/us/open, tiers from usCost, cash at the 3-month Treasury yield (data/us/cash-rate.json), benchmarks SPY, QQQ, MTUM (data/us/hist-bench).
// Corporate events (C-179 item 9): confirmed distributions and owner-confirmed moves come from settings/us-gap-events.json; the split guard blocks a name on a one-day move that matches a split ratio.
// Usage: node --max-old-space-size=6000 scripts/paper-books-us.mjs [--asof=YYYY-MM-DD] [--dry] [--only=<id>] [--start=YYYY-MM-DD]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { usCost } from '../src/backtest/us-loader.ts';
import { eligibleUs } from '../src/engine/momentum-sleeve.ts';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { newBook, stepBook, monthlyValues } from '../src/engine/stock-book.ts';
import { high52, weekly121, donchian, watchRanked, watchDonchian, industryMomentum, watchIndustry, pullback, watchPullback } from '../src/engine/first-wave.ts';
import { selectSleeve } from '../src/engine/momentum-sleeve.ts';
import { trendTemplate } from '../src/engine/sleeve-filters.ts';
import { newVt, stepVt, riskReturn } from '../src/engine/vol-target.ts';
import { scorecard } from '../src/engine/scorecard.ts';
import { splitLike, dayMove, bigFall } from '../src/engine/gap-events.ts';
import { loadDays } from './us-hist-lib.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3), ASOF = arg('asof'), ONLY = arg('only'), DRY = process.argv.includes('--dry');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const cfg = R('settings/first-wave-books-us.json'); if (!cfg) { console.error('no settings/first-wave-books-us.json'); process.exit(1); }
const BDIR = process.env.BOOKS_DIR || 'data/us/books', START = arg('start'), books = cfg.books.filter((b) => !ONLY || b.id === ONLY).map((b) => (START ? { ...b, startAfter: START } : b));

const tf = readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop(), tk = R('data/us/' + tf);
const allowed = new Set(tk.rows.filter(([, ty]) => ty === 'CS' || ty === 'ADRC').map(([sym]) => sym));
const days = loadDays(ASOF).map((d) => ({ date: d.date, rows: d.rows.filter((r) => allowed.has(r[0])) })), dates = days.map((d) => d.date), t = days.length - 1, D = dates[t];
const FH = buildHistories(days, [], allowed), series = FH.series, names = R('data/names.json', { us: {} }).us ?? {};
const el = eligibleUs(series, t).map((p) => ({ sym: p.sym, value: p.value }));
const OPEN = (() => { const f = `data/us/open/${D}.json.gz`; if (!existsSync(f)) return {}; try { return JSON.parse(gunzipSync(readFileSync(f))).open ?? {}; } catch { return {}; } })();
const openMissing = new Set(), open = (s) => { const o = OPEN[s]; if (o > 0) return o; openMissing.add(s); return NaN; };
const age = (sym) => { const s = series.get(sym); if (!s) return 0; for (let k = t; k >= Math.max(0, t - 30); k--) if (s.c[k] > 0) return t - k; return 31; };
const pxAt = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const cj = loadCalendarFiles(), cal = makeCalendar([...(cj['us']?.holidays ?? []), ...(cj['us']?.priorHolidays ?? [])]);
const events = R('settings/us-gap-events.json', []);
// SIC two-digit major group per ticker (C-180): data/us/sic.json rows are [ticker, sic, description, source]
const sicOf = new Map((R('data/us/sic.json', { rows: [] }).rows ?? []).map((r) => [r[0], String(Math.floor(r[1] / 100)).padStart(2, '0')]));

// Cash (C-179 item 7): 3-month Treasury yield, credited each session as yield x calendar days since the previous session / 360; a night with no figure for the date uses the latest earlier one and is counted;
// with no figure at all the cash earns zero and is counted as missing.
const cashSrc = R(cfg.cash.source, { source: null, series: {} }), cashDates = Object.keys(cashSrc.series).sort();
const cashRetFor = (st) => { if (!cashDates.length || t < 1) return { r: null }; const used = cashDates.filter((d) => d <= D).at(-1); if (!used) return { r: null }; const gap = (Date.parse(D) - Date.parse(dates[t - 1])) / 864e5; return { r: cashSrc.series[used] / 100 * gap / 360, carried: used !== D }; };
// Benchmarks and comparators, price only: month-end closes
const bars = (s) => { const f = `data/us/hist-bench/${s}.json.gz`; return existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString()).bars : []; };
const monthEnd = (bs) => { const o = new Map(); for (const b of bs) o.set(b[0].slice(0, 7), b); return o; };
const BM = Object.fromEntries(['SPY', 'QQQ', 'MTUM'].map((s) => [s, monthEnd(bars(s))]));
const closeOn = (s, d) => { const bs = bars(s); let v = null; for (const b of bs) { if (b[0] > d) break; v = b[1]; } return v; };
const mtumM = [...BM.MTUM].map(([m, b]) => ({ m, v: b[1] }));
const monthsOf = (st) => Object.entries(st?.monthly ?? {}).sort().map(([m, x]) => ({ m, v: x.v }));
const parent = R('data/us/momentum-sleeve-monthly-stop/state.json'), twin = R('data/us/momentum-sleeve-monthly/state.json');
const parentCost = (() => { const rv = parent?.reviews ?? [], ms = Object.keys(parent?.monthly ?? {}).length; return rv.length && ms ? rv.reduce((a, r) => a + (r.costPct ?? 0), 0) / 100 / ms : 0; })();
const tierUs = (v) => usCost(v);

const out = [], twinM = monthsOf(twin), has = (sym, date, kind) => events.find((e) => e.sym === sym && e.date === date && e.kind === kind);
for (const b of books) {
  const dir = `${BDIR}/${b.id}`, stFile = dir + '/state.json', st = R(stFile, null) ?? newBook(b.id, b.startAfter), wide = [];
  st.blocks ??= {}; st.gaps ??= []; st.cashCarried ??= 0;
  const gap = (g) => { if (!st.gaps.some((x) => x.date === g.date && x.sym === g.sym && x.kind === g.kind)) st.gaps.push(g); else { const x = st.gaps.find((y) => y.date === g.date && y.sym === g.sym && y.kind === g.kind); x.state = g.state; } };
  // split guard (C-179 item 9c): resolve old blocks, then block tonight's split-like moves (a confirmed distribution on that date is not a split)
  for (const [sym, bl] of Object.entries(st.blocks)) {
    const s = series.get(sym), i = dates.indexOf(bl.date), m = s && i > 0 ? dayMove(s.c, i) : null;
    if (has(sym, bl.date, 'real')) { delete st.blocks[sym]; gap({ date: bl.date, sym, kind: 'blocked', move: bl.move, state: 'resolved: confirmed real' }); }
    else if (!m || !splitLike(m.ratio)) { delete st.blocks[sym]; gap({ date: bl.date, sym, kind: 'blocked', move: bl.move, state: 'resolved: base files re-cut' }); }
  }
  const watchSyms = new Set([...el.map((p) => p.sym), ...Object.keys(st.pos)]);
  for (const sym of watchSyms) { if (st.blocks[sym]) continue; const s = series.get(sym), m = s ? dayMove(s.c, t) : null;
    if (m && splitLike(m.ratio) && !has(sym, D, 'distribution') && !has(sym, D, 'real')) { st.blocks[sym] = { date: D, ratio: Math.round(m.ratio * 1e4) / 1e4, move: Math.round((m.ratio - 1) * 1e4) / 1e4 }; gap({ date: D, sym, kind: 'blocked', move: st.blocks[sym].move, state: 'blocked' }); } }
  const blocked = (sym) => sym in st.blocks, px = (sym) => { const bl = st.blocks[sym]; return bl ? pxAt(sym, dates.indexOf(bl.date) - 1) : pxAt(sym, t); };
  const dist = (sym) => { const e = has(sym, D, 'distribution'); if (e?.perShare > 0 && st.pos[sym] && st.started) { gap({ date: D, sym, kind: 'distribution credited', move: null, state: `${e.perShare} a share credited` }); return e.perShare; } return 0; };
  const elOk = el.filter((p) => !blocked(p.sym)), ctxOf = (held) => ({ el: elOk, series, t, dates, held, group: (sym) => sicOf.get(sym) ?? null });
  let pc = null; const pullCtx = (held) => { if (pc) return { ...pc, held }; const sel = selectSleeve(elOk.slice(0, 200), series, t, held), order = sel.ranked.map((r) => r.sym), qn = Math.floor(order.length * 0.2); pc = { ...ctxOf(held), quintile: new Set(order.slice(0, qn)), template: new Set(order.filter((s) => trendTemplate(series.get(s)?.c ?? [], t) === true)), order }; return pc; };
  const plog = [];
  const signal = (held) => { const x = ctxOf(held); if (b.signal === 'industry') return industryMomentum(x); if (b.signal === 'pullback') return pullback(pullCtx(held), wide, plog); if (b.signal === 'high52') return high52(x); if (b.signal === 'weekly121') return weekly121(x); if (b.signal === 'donchian') return donchian(x, wide); return null; };
  const before = st.lastStep, cr = before === D ? { r: null } : cashRetFor(st); if (cr.carried && before !== D && st.started) st.cashCarried++;
  stepBook(st, { D, open, age, close: px, dist, blocked, cashRet: cr.r, tier: tierUs, signal });
  for (const w of wide) if (!st.skipped.some((s) => s.date === D && s.sym === w.sym)) st.skipped.push({ date: D, sym: w.sym, width: w.width });
  if (plog.length) st.signalLog = [...(st.signalLog ?? []), ...plog.filter((x) => !(st.signalLog ?? []).some((y) => y.date === x.date && y.sym === x.sym))].slice(-400);
  for (const q of st.stopQueue.filter((q) => q.on === D)) { const s = series.get(q.sym), m = s ? dayMove(s.c, t) : null; if (m && bigFall(m.ratio) && !has(q.sym, D, 'distribution')) gap({ date: D, sym: q.sym, kind: 'stop-out after fall', move: Math.round((m.ratio - 1) * 1e4) / 1e4, state: 'unconfirmed fall of 15% or more' }); }
  const v = st.daily.at(-1)?.v ?? null, hold = Object.entries(st.pos).map(([sym, p]) => ({ sym, name: names[sym] ?? null, entry: p.entry, entryDate: p.entryDate, last: Math.round(px(sym) * 100) / 100, sinceEntry: Math.round((px(sym) / p.entry - 1) * 1e4) / 1e4, stop: p.stop, high: p.high, blocked: blocked(sym) }));
  const wx = ctxOf(new Set(Object.keys(st.pos))), watch = b.signal === 'high52' || b.signal === 'weekly121' ? watchRanked(wx, b.signal) : b.signal === 'industry' ? watchIndustry(wx) : b.signal === 'pullback' ? watchPullback(pullCtx(new Set(Object.keys(st.pos)))) : watchDonchian(wx), watchRows = watch.map((r) => ({ ...r, name: r.group ? `${names[r.sym] ?? r.sym} (SIC ${r.group})` : names[r.sym] ?? null }));
  const bm = monthlyValues(st), comp = b.comparator === 'parent' ? monthsOf(parent) : mtumM, compName = b.comparator === 'parent' ? 'Stopped US parent (monthly review, 25% stop)' : 'MTUM (iShares MSCI USA Momentum Factor ETF), price only';
  const trades = st.closed.map((c) => c.ret - tierUs(st.lastValue[c.sym] ?? 0)), tr = { n: trades.length, avg: trades.length ? trades.reduce((a, x) => a + x, 0) / trades.length : null };
  const costs = Object.entries(st.costs ?? {}), bookCost = costs.length ? costs.reduce((a, [m, c]) => a + c / (bm.find((x) => x.m === m)?.v ?? st.daily.at(-1)?.v ?? 100), 0) / costs.length : 0, hurdle = Math.max(0, bookCost - (b.comparator === 'parent' ? parentCost : 0));
  const sc = bm.length ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), comp, tr, hurdle) : null;
  const base = bm[0]?.m, at = (arr, m) => arr.find((x) => x.m === m)?.v ?? null, bd = (m) => bm.find((x) => x.m === m)?.d, rb = (f) => { const b0 = base ? f(base) : null; return (m) => { const x = f(m); return b0 > 0 && x > 0 ? Math.round(x / b0 * 1e4) / 100 : null; }; };
  const lineOf = { book: rb((m) => at(bm, m)), spy: rb((m) => (bd(m) ? closeOn('SPY', bd(m)) : null)), qqq: rb((m) => (bd(m) ? closeOn('QQQ', bd(m)) : null)), twin: rb((m) => at(twinM, m)), mtum: rb((m) => (bd(m) ? closeOn('MTUM', bd(m)) : null)), comparator: rb((m) => at(comp, m)) };
  const lines = bm.map((x) => ({ m: x.m, ...Object.fromEntries(Object.entries(lineOf).map(([k, f]) => [k, f(x.m)])) }));
  const lat = { id: b.id, rule: b.rule, name: b.name, market: 'US', asOf: D, startAfter: b.startAfter, state: st.started ? 'running' : st.pending ? 'pending fill' : 'waiting', started: st.started, value: v, valueSens: st.daily.at(-1)?.vs ?? null,
    held: hold.length, cashShare: v ? Math.round(st.cash / v * 1e4) / 1e4 : null, positions: hold, pending: st.pending ? { signalDate: st.pending.signalDate, buys: st.pending.buys.map((x) => x.sym), sells: st.pending.sells } : null,
    closedTrades: st.closed.length, stopOuts: st.closed.filter((c) => c.why === 'stop').length, skippedWide: st.skipped.length, cashDays: st.cashDays, cashCarried: st.cashCarried, cashSource: cashSrc.source ?? 'none: cash earns zero', monthly: bm, daily: st.daily.slice(-400), recentClosed: st.closed.slice(-30),
    watch: watchRows, nextEntry: null, comparator: { id: b.comparator, name: compName }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5, scorecard: sc, lines, lineKeys: ['book', 'spy', 'qqq', 'twin', 'mtum', 'comparator'],
    gapEvents: st.gaps.slice(-60), blockedNow: Object.entries(st.blocks).map(([sym, x]) => ({ sym, ...x })), distCredit: Math.round((st.distCredit ?? 0) * 1e4) / 1e4, openFallbacks: openMissing.size,
    costNote: 'US tiers are market costs; they leave out your own brokerage and currency conversion (C-179 item 3).', sens: st.daily.length ? { book: st.daily.at(-1).vs, note: 'with a further 0.2% a round trip (C-178); a sensitivity, not a result' } : null };
  out.push({ id: b.id, rule: b.rule, name: b.name, market: 'US', state: lat.state, started: lat.started, held: lat.held, value: v, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: lat.closedTrades, stopOuts: lat.stopOuts, skippedWide: lat.skippedWide });
  if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(lat) + '\n'); }
}
// Sleeve-family books (C-182, C-185 filter, C-188): the US sleeve code with a pool filter, monthly review and the 25% stop (scripts/momentum-sleeve-us.mjs, MOM_FILTER). Read against the stopped US parent.
// A held name that stops trading is valued at its last close and sold at the next monthly review (known limit: the sleeve code has no last-close step).
const lineSet = (bm, bd, parM2, extra = {}) => { const base = bm[0]?.m, at = (arr, m) => arr.find((x) => x.m === m)?.v ?? null, rb = (f) => { const b0 = base ? f(base) : null; return (m) => { const x = f(m); return b0 > 0 && x > 0 ? Math.round(x / b0 * 1e4) / 100 : null; }; };
  const lineOf = { book: rb((m) => at(bm, m)), spy: rb((m) => (bd(m) ? closeOn('SPY', bd(m)) : null)), qqq: rb((m) => (bd(m) ? closeOn('QQQ', bd(m)) : null)), twin: rb((m) => at(twinM, m)), mtum: rb((m) => (bd(m) ? closeOn('MTUM', bd(m)) : null)), comparator: rb((m) => at(parM2, m)) };
  return bm.map((x) => ({ m: x.m, ...Object.fromEntries(Object.entries(lineOf).map(([k, f]) => [k, f(x.m)])) })); };
for (const b of cfg.sleeveBooks ?? []) {
  if (ONLY && b.id !== ONLY) continue;
  const st = R(b.dir + '/state.json'), lt = R(b.dir + '/latest.json'), started = st?.book?.startedFill ?? null, bm = monthsOf(st), parM2 = monthsOf(parent), rev = st?.reviews ?? [], ownMonths = Math.max(1, bm.length);
  const hurdle = Math.max(0, (rev.reduce((a, r) => a + (r.costPct ?? 0), 0) / 100 / ownMonths) - parentCost), sc = bm.length > 1 ? scorecard(bm, parM2, { n: 0, avg: null }, hurdle) : null;
  const rows = (lt?.rows ?? []).filter((r) => ['Held', 'In buffer', 'Would leave', 'Would enter', 'Preview'].includes(r.status) || r.rank <= 40), hold = rows.filter((r) => r.weightNow > 0).map((r) => ({ sym: r.sym, name: r.name, entry: r.entry, last: r.last, sinceEntry: r.sinceEntry, stop: 0.25 }));
  const watch = rows.slice(0, 60).map((r) => ({ rank: r.rank, sym: r.sym, name: r.name, score: r.score, status: r.status === 'Preview' ? '' : r.status })), value = lt?.valueIndex ?? null, stops = st?.stops ?? [];
  const lat = { id: b.id, rule: b.rule, name: b.name, market: 'US', asOf: lt?.asOf ?? D, startAfter: b.startAfter, state: started ? 'running' : st?.pending ? 'pending fill' : 'waiting', started, value, valueSens: null, held: lt?.heldCount ?? 0, cashShare: st?.book && value ? Math.round(st.book.cash / value * 1e4) / 1e4 : null,
    positions: hold, pending: st?.pending ? { signalDate: st.pending.signalDate } : null, closedTrades: stops.length, stopOuts: stops.length, skippedWide: 0, cashDays: null, watch, scoreKind: 'zscore', nextEntry: null, comparator: { id: 'parent', name: 'Stopped US parent (monthly review, 25% stop)' }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5,
    scorecard: sc, lines: lineSet(bm, (m) => st.monthly[m]?.d, parM2), lineKeys: ['book', 'spy', 'qqq', 'twin', 'mtum', 'comparator'], sens: null, perTradeNote: 'Per-trade statistics are not kept for sleeve-family books; that kill line is not applied.', costNote: 'US tiers are market costs; they leave out your own brokerage and currency conversion (C-179 item 3).' };
  out.push({ id: b.id, rule: b.rule, name: b.name, market: 'US', state: lat.state, started, held: lat.held, value, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: lat.closedTrades, stopOuts: lat.stopOuts, skippedWide: 0 });
  if (!DRY) { mkdirSync(`${BDIR}/${b.id}`, { recursive: true }); writeFileSync(`${BDIR}/${b.id}/latest.json`, JSON.stringify(lat) + '\n'); }
}
// Volatility-targeted sleeve (C-187): an overlay on the stopped US parent's daily series (src/engine/vol-target.ts); cash at the 3-month Treasury yield.
for (const b of cfg.volBooks ?? []) {
  if (ONLY && b.id !== ONLY) continue;
  const dir = `${BDIR}/${b.id}`, stFile = dir + '/state.json', st = R(stFile, null) ?? newVt(b.id, b.startAfter), pd = (R(b.parentDir + '/state.json')?.daily ?? []).map((x) => ({ d: x.d, v: x.v }));
  stepVt(st, pd, (d, prev) => { const used = cashDates.filter((x) => x <= d).at(-1); if (!used || !prev) return null; return cashSrc.series[used] / 100 * ((Date.parse(d) - Date.parse(prev)) / 864e5) / 360; }, b.oneWay);
  const bm = Object.entries(st.monthly).sort().map(([m, x]) => ({ m, v: x.v, d: x.d })), parM2 = monthsOf(parent), costM = Object.entries(st.costs), hurdle = costM.length ? costM.reduce((a, [m, c]) => a + c / 100, 0) / costM.length : 0;
  const sc = bm.length > 1 ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), parM2, { n: 0, avg: null }, hurdle) : null, v = st.daily.at(-1)?.v ?? null, rets = st.rets.slice(-60);
  const sd = (a) => { if (a.length < 2) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) * Math.sqrt(252); };
  const lat = { id: b.id, rule: b.rule, name: b.name, market: 'US', asOf: D, startAfter: b.startAfter, state: st.started ? 'running' : 'waiting', started: st.started, value: v, valueSens: null, held: 0, cashShare: st.exposure === null ? null : Math.round((1 - st.exposure) * 1e4) / 1e4, positions: [], pending: null, closedTrades: 0, stopOuts: 0, skippedWide: 0,
    cashDays: st.cashDays, cashSource: cashSrc.source ?? 'none: cash earns zero', watch: [], scoreKind: 'zscore', nextEntry: null, comparator: { id: 'parent', name: b.parentName }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5, scorecard: sc, lines: lineSet(bm, (m) => bm.find((x) => x.m === m)?.d, parM2), lineKeys: ['book', 'spy', 'qqq', 'twin', 'mtum', 'comparator'], sens: null,
    perTradeNote: 'This book is an overlay on the stopped US parent: it holds the parent\'s stocks scaled to a volatility target, so it has no trades of its own; that kill line is not applied.', exposure: st.exposure, exposures: st.reviews.slice(-12), riskReturn: riskReturn(st.daily.map((x) => ({ d: x.d, v: x.v })), pd), parentVol: sd(rets), costNote: b.costNote };
  out.push({ id: b.id, rule: b.rule, name: b.name, market: 'US', state: lat.state, started: st.started, held: 0, value: v, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: 0, stopOuts: 0, skippedWide: 0 });
  if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(lat) + '\n'); }
}
if (!DRY) { mkdirSync(BDIR, { recursive: true }); writeFileSync(BDIR + '/summary.json', JSON.stringify({ asOf: D, books: out }) + '\n'); }
console.log(JSON.stringify({ asOf: D, universe: el.length, openStored: Object.keys(OPEN).length, books: out.map((o) => ({ id: o.id, state: o.state, held: o.held, conf: o.confidence, kill: o.kill })) }));
