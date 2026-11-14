// Nightly first-wave paper books (Engine Rules C-161, C-163, C-164, C-166; shared terms C-159, C-173 to C-178). Paper only: no orders, no alerts.
// Reads settings/first-wave-books.json; for each book writes data/india/books/<id>/state.json (the paper book) and latest.json (what the page and the scorecard read).
// Signal on the close, fill at the next session's open (C-139). Usage: node --max-old-space-size=6000 scripts/paper-books.mjs [--asof=YYYY-MM-DD] [--dry] [--only=<id>]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE, tierCost } from '../src/backtest/ind-base.ts';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { newBook, stepBook, monthlyValues } from '../src/engine/stock-book.ts';
import { high52, weekly121, donchian, turnOfMonth, sessionsLeftInMonth, watchRanked, watchDonchian, watchTom, industryMomentum, watchIndustry, pullback, watchPullback } from '../src/engine/first-wave.ts';
import { valueLite, qualityLite, fallen, compounder, pead, valueRanked, qualityRanked, fallenPassers, compounderPassers } from '../src/engine/batch-a.ts';
import { magic, magicRanked } from '../src/engine/batch-b.ts';
import { stepEw } from '../src/engine/equal-weight.ts';
import { selectSleeve } from '../src/engine/momentum-sleeve.ts';
import { trendTemplate } from '../src/engine/sleeve-filters.ts';
import { newVt, stepVt, riskReturn } from '../src/engine/vol-target.ts';
import { scorecard } from '../src/engine/scorecard.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3), ASOF = arg('asof'), ONLY = arg('only'), DRY = process.argv.includes('--dry');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const cfg = R('settings/first-wave-books.json'); if (!cfg) { console.error('no settings/first-wave-books.json'); process.exit(1); }
const BDIR = process.env.BOOKS_DIR || 'data/india/books', START = arg('start'), books = cfg.books.filter((b) => !ONLY || b.id === ONLY).map((b) => (START ? { ...b, startAfter: START } : b));

const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date), sel0 = ASOF ? uniq.filter((d) => d.date <= ASOF) : uniq;
const actions = [...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(sel0, actions, ov), days = toDays(sel0), dates = days.map((d) => d.date), t = days.length - 1, D = dates[t];
const industry = R('data/india/segments.json', {}).industry ?? {}, names = R('data/names.json', { india: {} }).india ?? {}, allowed = new Set(Object.keys(industry));
for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const asOf = asOfHistories(days, t, res, allowed), FH = buildHistories(days, res.splits, allowed), series = FH.series;
const isCo = (sym) => sym in industry || sym in names;   // listed companies only: no ETFs or liquid funds
const el = eligible(asOf, t, BASE.skip).filter((p) => isCo(p.sym)).map((p) => ({ sym: p.sym, value: p.value }));
// Batch A (A0 table, claude/batch-a-fundamentals-rules-draft.md): the top 500 by traded value and the nightly company figures. Books that need them do nothing on a night the figures are not from tonight, and say so.
const el500 = (() => { const u = BASE.universe; BASE.universe = 500; try { return eligible(asOf, t, BASE.skip).filter((p) => isCo(p.sym)).map((p) => ({ sym: p.sym, value: p.value })); } finally { BASE.universe = u; } })();
const fundFile = R('data/india/fundamentals/latest.json'), fundOk = !!fundFile && fundFile.asOf === D, fundRows = fundOk ? fundFile.rows : {};
const BA_SIGNALS = new Set(['valueLite', 'qualityLite', 'fallen', 'compounder', 'pead', 'magic']);
const todayRows = uniq.find((d) => d.date === D)?.rows ?? {};
const open = (s) => { const r = todayRows[s]; return r && r[2] > 0 ? r[2] : NaN; };
const age = (sym) => { const s = series.get(sym); if (!s) return 0; for (let k = t; k >= Math.max(0, t - 30); k--) if (s.c[k] > 0) return t - k; return 31; };   // sessions since the name last had a close
const px = (sym, i = t) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const cj = loadCalendarFiles(), cal = makeCalendar([...(cj['india']?.holidays ?? []), ...(cj['india']?.priorHolidays ?? [])]);

// Fund NAV series (C-175, C-178 and the fourth benchmark line): each night append the latest NAV of the cash fund and of the Momentum 30 index fund from the AMFI file.
// Cash credit: each night the change between the two latest NAVs not yet credited; a night with no new NAV earns zero and is counted.
const navFile = 'data/india/fund-nav.json', navs = R(navFile, {});
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
try { const a = R('site/pm-data/amfi-schemes.json'), rows = a ? a[Object.keys(a).find((k) => !['asOf', 'cols'].includes(k))] : [];
  for (const f of cfg.navFunds) { const r = rows.find((x) => x[0] === f.code); navs[f.code] ??= { name: f.name, series: {} };
    if (r) { const [dd, mm, yy] = r[8].split('-'); const v = Number(r[7]); if (v > 0 && MON[mm]) navs[f.code].series[`${yy}-${MON[mm]}-${dd}`] = v; } } } catch {}
const cash = navs[cfg.cashFund.code]?.series ?? {}, navDates = Object.keys(cash).sort();
const cashRetFor = (st) => { const ds = navDates.filter((d) => d <= D && d > (st.lastNavDate ?? '')); if (!ds.length) return null; const last = ds.at(-1), before = navDates.filter((d) => d < ds[0]).at(-1); if (!before) { st.lastNavDate = last; return null; } const r = cash[last] / cash[before] - 1; st.lastNavDate = last; return r; };
const monthEndNav = (code) => { const s = navs[code]?.series ?? {}, o = new Map(); for (const d of Object.keys(s).sort()) o.set(d.slice(0, 7), s[d]); return [...o].map(([m, v]) => ({ m, v })); };
const monthsOf = (st) => Object.entries(st?.monthly ?? {}).sort().map(([m, x]) => ({ m, v: x.v }));
const parent = R('data/india/momentum-sleeve-monthly-stop/state.json'), twin = R('data/india/momentum-sleeve-monthly/state.json'), refm = R('data/india/momentum-sleeve/reference.json', {});
const idxStore = R('data/india/idx_closes.json', { closes: {} }).closes, idxAt = (key, d) => { const h = idxStore[key]; if (!h || !d) return null; const ds = Object.keys(h).filter((x) => x <= d).sort(); return ds.length ? h[ds.at(-1)] : null; };
const n500At = (d) => R(`data/india/tracker/${d}.json`)?.b?.close ?? null;
const parentCost = (() => { const rv = parent?.reviews ?? [], ms = Object.keys(parent?.monthly ?? {}).length; return rv.length && ms ? rv.reduce((a, r) => a + (r.costPct ?? 0), 0) / 100 / ms : 0; })();

const baWatch = (sig, held, stx) => {
  if (!fundOk) return [];
  const bx = { el: el500, series, t, dates, held, fund: fundRows, st: stx, group: (sym) => industry[sym] ?? null };
  if (sig === 'pead') return (stx.signalLog ?? []).slice(-30).reverse().map((r) => ({ sym: r.sym, status: r.taken ? 'Bought next open' : 'Skipped: ' + r.why, score: r.sue, date: r.date, reaction: r.reaction, volRatio: r.volRatio }));
  const rows = sig === 'valueLite' ? valueRanked(bx) : sig === 'qualityLite' ? qualityRanked(bx) : sig === 'fallen' ? fallenPassers(bx) : sig === 'magic' ? magicRanked(bx) : compounderPassers(bx);
  const r3 = (x) => (x == null || x !== x ? null : Math.round(x * 1000) / 1000);
  const state = (sym, rank) => (held.has(sym) ? (rank != null && rank <= 20 ? 'Held' : rank != null && rank <= 40 ? 'In buffer' : 'Would leave') : rank != null && rank <= 20 ? 'Would enter' : '');
  const out = rows.slice(0, 40).map((r, i) => ({ rank: i + 1, sym: r.sym, score: r3(r.s), status: state(r.sym, i + 1) }));
  for (const sym of held) if (!out.some((r) => r.sym === sym)) { const i = rows.findIndex((r) => r.sym === sym); out.push({ rank: i < 0 ? undefined : i + 1, sym, score: i < 0 ? null : r3(rows[i].s), status: i < 0 ? 'Would leave (no longer ranked)' : state(sym, i + 1) }); }
  return out;
};
const out = [], twinM0 = monthsOf(twin);
for (const b of books) {
  const dir = `${BDIR}/${b.id}`, stFile = dir + '/state.json', st = R(stFile, null) ?? newBook(b.id, b.startAfter), wide = [];
  const ctxOf = (held) => ({ el, series, t, dates, held, group: (sym) => industry[sym] ?? null });
  let pc = null; const pullCtx = (held) => { if (pc) return { ...pc, held }; const sel = selectSleeve(el.slice(0, 200), series, t, held), order = sel.ranked.map((r) => r.sym), qn = Math.floor(order.length * 0.2); pc = { ...ctxOf(held), quintile: new Set(order.slice(0, qn)), template: new Set(order.filter((s) => trendTemplate(series.get(s)?.c ?? [], t) === true)), order }; return pc; };
  const plog = [];
  const signal = (held, stx) => { if (BA_SIGNALS.has(b.signal)) { if (!fundOk) { st.fundMissing = (st.fundMissing ?? 0) + 1; return null; } const bx = { el: el500, series, t, dates, held, fund: fundRows, st: stx, group: (sym) => industry[sym] ?? null };
      return b.signal === 'valueLite' ? valueLite(bx) : b.signal === 'qualityLite' ? qualityLite(bx) : b.signal === 'fallen' ? fallen(bx) : b.signal === 'compounder' ? compounder(bx) : b.signal === 'magic' ? magic(bx) : pead(bx, wide, plog); }
    const x = ctxOf(held); if (b.signal === 'industry') return industryMomentum(x); if (b.signal === 'pullback') return pullback(pullCtx(held), wide, plog);
    if (b.signal === 'high52') return high52(x); if (b.signal === 'weekly121') return weekly121(x); if (b.signal === 'donchian') return donchian(x, wide);
    if (b.signal === 'turnOfMonth') return turnOfMonth(x, sessionsLeftInMonth(D, cal.sessionsBetween.bind(cal)), wide); return null; };
  const before = st.lastStep;
  stepBook(st, { D, open, age, close: (s) => px(s), cashRet: before === D ? null : cashRetFor(st), tier: (v) => tierCost(v), signal });
  if ((b.batch === 'A' || b.batch === 'B') && before !== D) stepEw(st, D, el500.map((p) => p.sym), (s) => { const v = px(s); return v > 0 ? v : null; });
  for (const w of wide) if (!st.skipped.some((s) => s.date === D && s.sym === w.sym)) st.skipped.push({ date: D, sym: w.sym, width: w.width });
  if (plog.length) { st.signalLog = [...(st.signalLog ?? []), ...plog.filter((x) => !(st.signalLog ?? []).some((y) => y.date === x.date && y.sym === x.sym))].slice(-400); }
  const v = st.daily.at(-1)?.v ?? null, hold = Object.entries(st.pos).map(([sym, p]) => ({ sym, name: names[sym] ?? null, entry: p.entry, entryDate: p.entryDate, last: Math.round(px(sym) * 100) / 100, sinceEntry: Math.round((px(sym) / p.entry - 1) * 1e4) / 1e4, stop: p.stop, high: p.high }));
  // tonight's list for the stock-list view
  const wx = ctxOf(new Set(Object.keys(st.pos))), watch = BA_SIGNALS.has(b.signal) ? baWatch(b.signal, new Set(Object.keys(st.pos)), st) : b.signal === 'high52' || b.signal === 'weekly121' ? watchRanked(wx, b.signal) : b.signal === 'donchian' ? watchDonchian(wx) : b.signal === 'industry' ? watchIndustry(wx) : b.signal === 'pullback' ? watchPullback(pullCtx(new Set(Object.keys(st.pos)))) : watchTom(wx);
  const nm = (r) => ({ ...r, name: (names[r.sym] ?? null) && r.group ? `${names[r.sym]} (${r.group})` : names[r.sym] ?? null }), watchRows = watch.map(nm);
  // scorecard against the one comparator (C-176); the four reported lines are shown whatever the comparator is
  const bm = monthlyValues(st), fundM = monthEndNav('148703'), liqM = monthEndNav(cfg.cashFund.code), parM = monthsOf(parent), twinM = monthsOf(twin);
  const n500M = bm.map((x) => ({ m: x.m, v: n500At(x.d) })).filter((x) => x.v > 0), valM = monthEndNav('151739');
  const comp = b.comparator === 'parent' ? parM : b.comparator === 'fund' ? fundM : b.comparator === 'n500' ? n500M : b.comparator === 'valueFund' ? valM : liqM, compName = b.comparator === 'parent' ? 'Stopped parent (monthly review, 25% stop)' : b.comparator === 'fund' ? 'Momentum 30 index fund' : b.comparator === 'n500' ? 'Nifty 500' : b.comparator === 'valueFund' ? 'Nifty 500 Value 50 index fund (UTI; tracking difference not verified, no index return series on the desk)' : 'Liquid fund rate';
  const trades = st.closed.map((c) => c.ret - tierCost(st.lastValue[c.sym] ?? 0)), tr = { n: trades.length, avg: trades.length ? trades.reduce((a, x) => a + x, 0) / trades.length : null };
  const costs = Object.entries(st.costs ?? {}), bookCost = costs.length ? costs.reduce((a, [m, c]) => a + c / (bm.find((x) => x.m === m)?.v ?? st.daily.at(-1)?.v ?? 100), 0) / costs.length : 0, hurdle = Math.max(0, bookCost - (b.comparator === 'parent' ? parentCost : 0));
  const sc = bm.length ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), comp, tr, hurdle) : null;
  const base = bm[0]?.m, at = (arr, m) => arr.find((x) => x.m === m)?.v ?? null, bd = (m) => bm.find((x) => x.m === m)?.d, rb = (f) => { const b0 = base ? f(base) : null; return (m) => { const x = f(m); return b0 > 0 && x > 0 ? Math.round(x / b0 * 1e4) / 100 : null; }; };
  const lineOf = { book: rb((m) => at(bm, m)), n200: rb((m) => (bd(m) ? idxAt('Nifty 200', bd(m)) : null) ?? refm[m]?.nifty200 ?? null), n500: rb((m) => n500At(bd(m))), twin: rb((m) => at(twinM, m)), fund: rb((m) => at(fundM, m)), ...(b.batch === 'A' || b.batch === 'B' ? { ew: rb((m) => (bd(m) ? st.ew?.nav?.[bd(m)] ?? null : null)) } : {}), comparator: rb((m) => at(comp, m)) };
  const lines = bm.map((x) => ({ m: x.m, ...Object.fromEntries(Object.entries(lineOf).map(([k, f]) => [k, f(x.m)])) }));
  const nextEntry = b.signal === 'turnOfMonth' ? (() => { for (let k = 0; k < 45; k++) { const d = cal.addSessions(D, k); if (sessionsLeftInMonth(d, cal.sessionsBetween.bind(cal)) === 4) return d; } return null; })() : null;
  const nonFin = Object.values(fundRows).filter((r) => !r.financial), magicOk = new Set(magicRanked({ el: el500, series, t, dates, held: new Set(), fund: fundRows, st, group: (sym) => industry[sym] ?? null }).map((r) => r.sym));
  const lat = { unscored: b.signal === 'magic' && fundOk ? { text: `${Math.max(0, nonFin.length - magicOk.size)} of ${nonFin.length} non-financial names are not ranked (power companies, no balance sheet read with the investment lines yet, or no positive operating profit or capital base).` } : ['qualityLite', 'fallen', 'compounder'].includes(b.signal) && fundOk ? { noInterest: fundFile.coverage?.noInterest ?? null, universe: Object.keys(fundRows).length } : null, id: b.id, rule: b.rule, name: b.name, asOf: D, startAfter: b.startAfter, state: st.started ? 'running' : st.pending ? 'pending fill' : 'waiting', started: st.started, value: v, valueSens: st.daily.at(-1)?.vs ?? null,
    held: hold.length, cashShare: v ? Math.round(st.cash / v * 1e4) / 1e4 : null, positions: hold, pending: st.pending ? { signalDate: st.pending.signalDate, buys: st.pending.buys.map((x) => x.sym), sells: st.pending.sells } : null,
    closedTrades: st.closed.length, stopOuts: st.closed.filter((c) => c.why === 'stop').length, skippedWide: st.skipped.length, cashDays: st.cashDays, monthly: bm, daily: st.daily.slice(-400), recentClosed: st.closed.slice(-30),
    watch: watchRows, nextEntry, comparator: { id: b.comparator, name: compName }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5, scorecard: sc, lines, sens: st.daily.length ? { book: st.daily.at(-1).vs, note: 'with a further 0.2% a round trip (C-178); a sensitivity, not a result' } : null };
  out.push({ id: b.id, rule: b.rule, name: b.name, state: lat.state, started: lat.started, held: lat.held, value: v, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: lat.closedTrades, stopOuts: lat.stopOuts, skippedWide: lat.skippedWide });
  if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(lat) + '\n'); }
}
if (!DRY) writeFileSync(navFile, JSON.stringify(navs) + '\n');

// Sleeve-family books (C-162, C-165 filter, C-168): the momentum sleeve code with a pool filter, monthly review and the 25% stop; their state is the sleeve's own (scripts/momentum-sleeve.mjs, MOM_FILTER).
// Here they get the same scorecard as the other books, read against the stopped parent (C-173, C-176). Per-trade statistics are not kept for them, so that kill line is not applied.
const parM = monthsOf(parent);
for (const b of cfg.sleeveBooks ?? []) {
  const st = R(b.dir + '/state.json'), lt = R(b.dir + '/latest.json'), started = st?.book?.startedFill ?? null, bm = monthsOf(st);
  const rev = st?.reviews ?? [], parentMonths = Math.max(1, Object.keys(parent?.monthly ?? {}).length), ownMonths = Math.max(1, bm.length);
  const hurdle = Math.max(0, (rev.reduce((a, r) => a + (r.costPct ?? 0), 0) / 100 / ownMonths) - parentCost);
  const sc = bm.length > 1 ? scorecard(bm, parM, { n: 0, avg: null }, hurdle) : null;
  const base = bm[0]?.m, at = (arr, m) => arr.find((x) => x.m === m)?.v ?? null, bd = (m) => st.monthly[m]?.d, rb = (f) => { const b0 = base ? f(base) : null; return (m) => { const x = f(m); return b0 > 0 && x > 0 ? Math.round(x / b0 * 1e4) / 100 : null; }; };
  const lineOf = { book: rb((m) => at(bm, m)), n200: rb((m) => (bd(m) ? idxAt('Nifty 200', bd(m)) : null) ?? refm[m]?.nifty200 ?? null), n500: rb((m) => n500At(bd(m))), twin: rb((m) => at(twinM0, m)), fund: rb((m) => at(monthEndNav('148703'), m)), comparator: rb((m) => at(parM, m)) };
  const rows = (lt?.rows ?? []).filter((r) => ['Held', 'In buffer', 'Would leave', 'Would enter', 'Preview'].includes(r.status) || r.rank <= 40);
  const hold = rows.filter((r) => r.weightNow > 0).map((r) => ({ sym: r.sym, name: r.name, entry: r.entry, last: r.last, sinceEntry: r.sinceEntry, stop: 0.25 }));
  const watch = rows.slice(0, 60).map((r) => ({ rank: r.rank, sym: r.sym, name: r.name, score: r.score, status: r.status === 'Preview' ? '' : r.status === 'Would enter' ? 'Would enter' : r.status }));
  const value = lt?.valueIndex ?? null, stops = st?.stops ?? [];
  const lat = { id: b.id, rule: b.rule, name: b.name, asOf: lt?.asOf ?? D, startAfter: b.startAfter, state: started ? 'running' : st?.pending ? 'pending fill' : 'waiting', started, value, valueSens: null, held: lt?.heldCount ?? 0, cashShare: st?.book && value ? Math.round(st.book.cash / value * 1e4) / 1e4 : null,
    positions: hold, pending: st?.pending ? { signalDate: st.pending.signalDate } : null, closedTrades: stops.length, stopOuts: stops.length, skippedWide: 0, cashDays: null, watch, scoreKind: 'zscore', nextEntry: null,
    comparator: { id: 'parent', name: 'Stopped parent (monthly review, 25% stop)' }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5, scorecard: sc, lines: bm.map((x) => ({ m: x.m, ...Object.fromEntries(Object.entries(lineOf).map(([k, f]) => [k, f(x.m)])) })), sens: null, perTradeNote: 'Per-trade statistics are not kept for sleeve-family books; that kill line is not applied.' };
  out.push({ id: b.id, rule: b.rule, name: b.name, state: lat.state, started, held: lat.held, value, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: lat.closedTrades, stopOuts: lat.stopOuts, skippedWide: 0 });
  if (!DRY) { mkdirSync(`${BDIR}/${b.id}`, { recursive: true }); writeFileSync(`${BDIR}/${b.id}/latest.json`, JSON.stringify(lat) + '\n'); }
}
// Volatility-targeted sleeve (C-167): an overlay on the stopped parent's daily series, see src/engine/vol-target.ts.
for (const b of cfg.volBooks ?? []) {
  const dir = `${BDIR}/${b.id}`, stFile = dir + '/state.json', st = R(stFile, null) ?? newVt(b.id, b.startAfter), pd = (R(b.parentDir + '/state.json')?.daily ?? []).map((x) => ({ d: x.d, v: x.v }));
  stepVt(st, pd, (d) => { const i = navDates.indexOf(d); return i > 0 ? cash[d] / cash[navDates[i - 1]] - 1 : null; }, b.oneWay);
  const bm = Object.entries(st.monthly).sort().map(([m, x]) => ({ m, v: x.v, d: x.d })), parM2 = monthsOf(parent), costM = Object.entries(st.costs), hurdle = costM.length ? costM.reduce((a, [m, c]) => a + c / 100, 0) / costM.length : 0;
  const sc = bm.length > 1 ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), parM2, { n: 0, avg: null }, hurdle) : null, base = bm[0]?.m, at = (arr, m) => arr.find((x) => x.m === m)?.v ?? null, bd = (m) => bm.find((x) => x.m === m)?.d, rb = (f) => { const b0 = base ? f(base) : null; return (m) => { const x = f(m); return b0 > 0 && x > 0 ? Math.round(x / b0 * 1e4) / 100 : null; }; };
  const lineOf = { book: rb((m) => at(bm, m)), n200: rb((m) => (bd(m) ? idxAt('Nifty 200', bd(m)) : null)), n500: rb((m) => n500At(bd(m))), twin: rb((m) => at(twinM0, m)), fund: rb((m) => at(monthEndNav('148703'), m)), comparator: rb((m) => at(parM2, m)) };
  const v = st.daily.at(-1)?.v ?? null, rets = st.rets.slice(-60), sd = (a) => { if (a.length < 2) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) * Math.sqrt(252); };
  const lat = { id: b.id, rule: b.rule, name: b.name, market: b.market ?? 'India', asOf: D, startAfter: b.startAfter, state: st.started ? 'running' : 'waiting', started: st.started, value: v, valueSens: null, held: 0, cashShare: st.exposure === null ? null : Math.round((1 - st.exposure) * 1e4) / 1e4, positions: [], pending: null, closedTrades: 0, stopOuts: 0, skippedWide: 0,
    cashDays: st.cashDays, watch: [], scoreKind: 'zscore', nextEntry: null, comparator: { id: 'parent', name: b.parentName }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5, scorecard: sc, lines: bm.map((x) => ({ m: x.m, ...Object.fromEntries(Object.entries(lineOf).map(([k, f]) => [k, f(x.m)])) })), sens: null,
    perTradeNote: 'This book is an overlay on the stopped parent: it holds the parent\'s stocks scaled to a volatility target, so it has no trades of its own; that kill line is not applied.', exposure: st.exposure, exposures: st.reviews.slice(-12), riskReturn: riskReturn(st.daily.map((x) => ({ d: x.d, v: x.v })), pd), parentVol: sd(rets), costNote: b.costNote };
  out.push({ id: b.id, rule: b.rule, name: b.name, market: lat.market, state: lat.state, started: st.started, held: 0, value: v, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: 0, stopOuts: 0, skippedWide: 0 });
  if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(lat) + '\n'); }
}
if (!DRY) { mkdirSync(BDIR, { recursive: true }); writeFileSync(BDIR + '/summary.json', JSON.stringify({ asOf: D, books: out }) + '\n'); }
console.log(JSON.stringify({ asOf: D, universe: el.length, books: out.map((o) => ({ id: o.id, state: o.state, held: o.held, conf: o.confidence, kill: o.kill })) }));
