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
import { high52, weekly121, donchian, turnOfMonth, sessionsLeftInMonth, watchRanked, watchDonchian, watchTom } from '../src/engine/first-wave.ts';
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
const todayRows = uniq.find((d) => d.date === D)?.rows ?? {};
const open = (s) => { const r = todayRows[s]; return r && r[2] > 0 ? r[2] : NaN; };
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

const out = [];
for (const b of books) {
  const dir = `${BDIR}/${b.id}`, stFile = dir + '/state.json', st = R(stFile, null) ?? newBook(b.id, b.startAfter), wide = [];
  const ctxOf = (held) => ({ el, series, t, dates, held });
  const signal = (held) => { const x = ctxOf(held);
    if (b.signal === 'high52') return high52(x); if (b.signal === 'weekly121') return weekly121(x); if (b.signal === 'donchian') return donchian(x, wide);
    if (b.signal === 'turnOfMonth') return turnOfMonth(x, sessionsLeftInMonth(D, cal.sessionsBetween.bind(cal)), wide); return null; };
  const before = st.lastStep;
  stepBook(st, { D, open, close: (s) => px(s), cashRet: before === D ? null : cashRetFor(st), tier: (v) => tierCost(v), signal });
  for (const w of wide) if (!st.skipped.some((s) => s.date === D && s.sym === w.sym)) st.skipped.push({ date: D, sym: w.sym, width: w.width });
  const v = st.daily.at(-1)?.v ?? null, hold = Object.entries(st.pos).map(([sym, p]) => ({ sym, name: names[sym] ?? null, entry: p.entry, entryDate: p.entryDate, last: Math.round(px(sym) * 100) / 100, sinceEntry: Math.round((px(sym) / p.entry - 1) * 1e4) / 1e4, stop: p.stop, high: p.high }));
  // tonight's list for the stock-list view
  const wx = ctxOf(new Set(Object.keys(st.pos))), watch = b.signal === 'high52' || b.signal === 'weekly121' ? watchRanked(wx, b.signal) : b.signal === 'donchian' ? watchDonchian(wx) : watchTom(wx);
  const nm = (r) => ({ ...r, name: names[r.sym] ?? null }), watchRows = watch.map(nm);
  // scorecard against the one comparator (C-176); the four reported lines are shown whatever the comparator is
  const bm = monthlyValues(st), fundM = monthEndNav('148703'), liqM = monthEndNav(cfg.cashFund.code), parM = monthsOf(parent), twinM = monthsOf(twin);
  const comp = b.comparator === 'parent' ? parM : b.comparator === 'fund' ? fundM : liqM, compName = b.comparator === 'parent' ? 'Stopped parent (monthly review, 25% stop)' : b.comparator === 'fund' ? 'Momentum 30 index fund' : 'Liquid fund rate';
  const trades = st.closed.map((c) => c.ret - tierCost(st.lastValue[c.sym] ?? 0)), tr = { n: trades.length, avg: trades.length ? trades.reduce((a, x) => a + x, 0) / trades.length : null };
  const costs = Object.entries(st.costs ?? {}), bookCost = costs.length ? costs.reduce((a, [m, c]) => a + c / (bm.find((x) => x.m === m)?.v ?? st.daily.at(-1)?.v ?? 100), 0) / costs.length : 0, hurdle = Math.max(0, bookCost - (b.comparator === 'parent' ? parentCost : 0));
  const sc = bm.length ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), comp, tr, hurdle) : null;
  const base = bm[0]?.m, at = (arr, m) => arr.find((x) => x.m === m)?.v ?? null, bd = (m) => bm.find((x) => x.m === m)?.d, rb = (f) => { const b0 = base ? f(base) : null; return (m) => { const x = f(m); return b0 > 0 && x > 0 ? Math.round(x / b0 * 1e4) / 100 : null; }; };
  const lineOf = { book: rb((m) => at(bm, m)), n200: rb((m) => (bd(m) ? idxAt('Nifty 200', bd(m)) : null) ?? refm[m]?.nifty200 ?? null), n500: rb((m) => n500At(bd(m))), twin: rb((m) => at(twinM, m)), fund: rb((m) => at(fundM, m)), comparator: rb((m) => at(comp, m)) };
  const lines = bm.map((x) => ({ m: x.m, ...Object.fromEntries(Object.entries(lineOf).map(([k, f]) => [k, f(x.m)])) }));
  const nextEntry = b.signal === 'turnOfMonth' ? (() => { for (let k = 0; k < 45; k++) { const d = cal.addSessions(D, k); if (sessionsLeftInMonth(d, cal.sessionsBetween.bind(cal)) === 4) return d; } return null; })() : null;
  const lat = { id: b.id, rule: b.rule, name: b.name, asOf: D, startAfter: b.startAfter, state: st.started ? 'running' : st.pending ? 'pending fill' : 'waiting', started: st.started, value: v, valueSens: st.daily.at(-1)?.vs ?? null,
    held: hold.length, cashShare: v ? Math.round(st.cash / v * 1e4) / 1e4 : null, holdings: hold, pending: st.pending ? { signalDate: st.pending.signalDate, buys: st.pending.buys.map((x) => x.sym), sells: st.pending.sells } : null,
    closedTrades: st.closed.length, stopOuts: st.closed.filter((c) => c.why === 'stop').length, skippedWide: st.skipped.length, cashDays: st.cashDays, monthly: bm, daily: st.daily.slice(-400), recentClosed: st.closed.slice(-30),
    watch: watchRows, nextEntry, comparator: { id: b.comparator, name: compName }, hurdleMonthly: Math.round(hurdle * 1e5) / 1e5, scorecard: sc, lines, sens: st.daily.length ? { book: st.daily.at(-1).vs, note: 'with a further 0.2% a round trip (C-178); a sensitivity, not a result' } : null };
  out.push({ id: b.id, rule: b.rule, name: b.name, state: lat.state, started: lat.started, held: lat.held, value: v, cashShare: lat.cashShare, comparator: lat.comparator.name, months: sc?.months ?? 0, sinceStart: sc?.sinceStart ?? null, excessLastMonth: sc?.excessLastMonth ?? null, confidence: sc ? Math.round(sc.confidence.confidence * 1000) / 1000 : null, kill: sc?.kill.status ?? null, closedTrades: lat.closedTrades, stopOuts: lat.stopOuts, skippedWide: lat.skippedWide });
  if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(lat) + '\n'); }
}
if (!DRY) writeFileSync(navFile, JSON.stringify(navs) + '\n');
if (!DRY) { mkdirSync(BDIR, { recursive: true }); writeFileSync(BDIR + '/summary.json', JSON.stringify({ asOf: D, books: out }) + '\n'); }
console.log(JSON.stringify({ asOf: D, universe: el.length, books: out.map((o) => ({ id: o.id, state: o.state, held: o.held, conf: o.confidence, kill: o.kill })) }));
