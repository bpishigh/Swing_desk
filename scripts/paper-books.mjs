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
import { high52, weekly121, donchian, turnOfMonth, sessionsLeftInMonth } from '../src/engine/first-wave.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3), ASOF = arg('asof'), ONLY = arg('only'), DRY = process.argv.includes('--dry');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const cfg = R('settings/first-wave-books.json'); if (!cfg) { console.error('no settings/first-wave-books.json'); process.exit(1); }
const START = arg('start'), books = cfg.books.filter((b) => !ONLY || b.id === ONLY).map((b) => (START ? { ...b, startAfter: START } : b));

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

// Liquid-fund NAV series for the cash credit (C-175, C-178): append the latest NAV from the AMFI file, then credit each night the change between the two latest NAVs not yet credited.
const navFile = 'data/india/liquid-fund-nav.json', nav = R(navFile, { code: cfg.cashFund.code, series: {} });
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
try { const a = R('site/pm-data/amfi-schemes.json'), rows = a ? a[Object.keys(a).find((k) => !['asOf', 'cols'].includes(k))] : []; const r = rows.find((x) => x[0] === cfg.cashFund.code);
  if (r) { const [dd, mm, yy] = r[8].split('-'), iso = `${yy}-${MON[mm]}-${dd}`, v = Number(r[7]); if (v > 0 && MON[mm]) nav.series[iso] = v; } } catch {}
const navDates = Object.keys(nav.series).sort();
const cashRetFor = (st) => { const ds = navDates.filter((d) => d <= D && d > (st.lastNavDate ?? '')); if (!ds.length) return null; const last = ds.at(-1), before = navDates.filter((d) => d < ds[0]).at(-1); if (!before) { st.lastNavDate = last; return null; } const r = nav.series[last] / nav.series[before] - 1; st.lastNavDate = last; return r; };

const out = [];
for (const b of books) {
  const dir = `data/india/books/${b.id}`, stFile = dir + '/state.json', st = R(stFile, null) ?? newBook(b.id, b.startAfter), wide = [];
  const ctxOf = (held) => ({ el, series, t, dates, held });
  const signal = (held) => { const x = ctxOf(held);
    if (b.signal === 'high52') return high52(x); if (b.signal === 'weekly121') return weekly121(x); if (b.signal === 'donchian') return donchian(x, wide);
    if (b.signal === 'turnOfMonth') return turnOfMonth(x, sessionsLeftInMonth(D, cal.sessionsBetween.bind(cal)), wide); return null; };
  const before = st.lastStep;
  stepBook(st, { D, open, close: (s) => px(s), cashRet: before === D ? null : cashRetFor(st), tier: (v) => tierCost(v), signal });
  for (const w of wide) if (!st.skipped.some((s) => s.date === D && s.sym === w.sym)) st.skipped.push({ date: D, sym: w.sym, width: w.width });
  const v = st.daily.at(-1)?.v ?? null, hold = Object.entries(st.pos).map(([sym, p]) => ({ sym, name: names[sym] ?? null, entry: p.entry, entryDate: p.entryDate, last: Math.round(px(sym) * 100) / 100, sinceEntry: Math.round((px(sym) / p.entry - 1) * 1e4) / 1e4, stop: p.stop, high: p.high }));
  const lat = { id: b.id, rule: b.rule, name: b.name, asOf: D, startAfter: b.startAfter, state: st.started ? 'running' : st.pending ? 'pending fill' : 'waiting', started: st.started, value: v, valueSens: st.daily.at(-1)?.vs ?? null,
    held: hold.length, cashShare: v ? Math.round(st.cash / v * 1e4) / 1e4 : null, holdings: hold, pending: st.pending ? { signalDate: st.pending.signalDate, buys: st.pending.buys.map((x) => x.sym), sells: st.pending.sells } : null,
    closedTrades: st.closed.length, stopOuts: st.closed.filter((c) => c.why === 'stop').length, skippedWide: st.skipped.length, cashDays: st.cashDays, monthly: monthlyValues(st), daily: st.daily.slice(-400), recentClosed: st.closed.slice(-30) };
  out.push({ id: b.id, state: lat.state, held: lat.held, value: v, pending: lat.pending ? lat.pending.signalDate : null });
  if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(lat) + '\n'); }
}
if (!DRY) writeFileSync(navFile, JSON.stringify(nav) + '\n');
console.log(JSON.stringify({ asOf: D, universe: el.length, books: out }));
