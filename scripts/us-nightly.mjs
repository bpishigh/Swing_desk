// Repo Desk US daily data: SPY, QQQ and the 14 sector ETFs from Tiingo (raw close + published split factors), each day's close checked
// against StockAnalysis, VIX from Cboe. Writes data/us/ in the shapes the app reads (tracker, feed, feed_hist, closes).
// Usage: node scripts/us-nightly.mjs [--date=YYYY-MM-DD] [--backfill=N] [--dir=data/us] [--offline=<folder>]
//   --offline reads <TICKER>.json (a Tiingo reply), sa-<TICKER>.html and cboe.csv from the folder instead of the network.
// Needs TIINGO_KEY (GitHub secret). FRED_KEY is optional (cross-checks the previous day's VIX).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { join } from 'node:path';
import { makeCalendar } from '../src/engine/calendar.ts';
import { nasdaqBars } from './nasdaq.mjs';
import { SECTORS, US_TICKERS, parseTiingo, mergeBars, usStats, adjustedThrough, parseStockAnalysis, parseCboeVix, agree } from '../src/ingest/us-eod.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const DIR = arg('dir') || 'data/us';
const OFFLINE = arg('offline');
const BACKFILL = Math.min(300, Number(arg('backfill') || 0));
const KEY = process.env.TIINGO_KEY;
const START = '2024-09-01';   // first fetch for a ticker with nothing stored: ~2 years, enough for a 200 SMA and 3-month returns
const calFile = loadCalendarFiles().us;
const cal = makeCalendar(calFile.holidays);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const write = (p, o, pretty = true) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, pretty ? JSON.stringify(o, null, 1) + '\n' : JSON.stringify(o) + '\n'); };
const names = (l) => (l.length <= 2 ? l.join(', ') : `${l.slice(0, 2).join(', ')} and ${l.length - 2} more`);   // flags never list three or more tickers

// Target session: today (New York) once the close is well past, else the previous session.
function etNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
let D = arg('date');
if (!D) { const t = etNow(); D = cal.isSession(t.date) && t.minutes >= 17 * 60 + 30 ? t.date : cal.prevSession(t.date); }

const report = { ts: new Date().toISOString(), date: D, status: 'unknown', fetched: {}, conflicts: [], flags: [] };
const finish = (code, status) => { report.status = status; write(join(DIR, 'last-run.json'), report); console.log(JSON.stringify(report).slice(0, 2500)); process.exit(code); };
if (!OFFLINE && !KEY) { report.flags.push('TIINGO_KEY is not set'); finish(1, 'no key'); }
if (!cal.isSession(D)) finish(0, `${D} is not a US session`);

// ---- 1. Tiingo bars ---------------------------------------------------------------------------------------------------
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
async function tiingo(t, start) {
  if (OFFLINE) { const p = join(OFFLINE, `${t}.json`); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []; }
  let last;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://api.tiingo.com/tiingo/daily/${t.toLowerCase()}/prices?startDate=${start}&token=${KEY}`, { headers: { 'content-type': 'application/json' } });
      if (r.status === 429) throw Object.assign(new Error('rate limited (429)'), { stop: true });
      if (r.status === 404) throw Object.assign(new Error('unknown ticker (404)'), { stop: true });
      if (!r.ok) { last = new Error(`status ${r.status}`); await sleep(2000 * (a + 1)); continue; }
      return await r.json();
    } catch (e) { last = e; if (e.stop) break; await sleep(2000 * (a + 1)); }
  }
  throw last;
}
const eodPath = (t) => join(DIR, 'eod', `${t}.json`);
const bars = {}, failed = [], viaNasdaq = [];
for (const t of US_TICKERS) {
  const stored = read(eodPath(t), []);
  try {
    const from = stored.length ? addDays(stored[stored.length - 1][0], -7) : START;
    let parsed;
    try { if (process.env.BACKUP_ONLY === '1') throw new Error('Tiingo skipped (backup test)'); parsed = parseTiingo(await tiingo(t, from)); }   // BACKUP_ONLY: test hook
    catch (e) {
      if (OFFLINE) throw e;
      try { parsed = await nasdaqBars(t, 'etf', from); viaNasdaq.push(t); } catch { throw e; }   // Tiingo down or at its hourly limit: Nasdaq's public history instead
    }
    const { bars: fresh, dropped } = parsed;
    const m = mergeBars(stored, fresh);
    bars[t] = m.bars;
    report.fetched[t] = { rows: fresh.length, added: m.added, ...(dropped ? { dropped } : {}) };
    for (const c of m.conflicts) report.conflicts.push(`${t} ${c}`);
    if (m.added) write(eodPath(t), m.bars, false);
  } catch (e) { failed.push(t); bars[t] = stored; report.flags.push(`${t}: Tiingo ${e.message}`); }
  if (!OFFLINE) await sleep(400);
}
if (viaNasdaq.length) report.flags.push(`Tiingo was unavailable for ${viaNasdaq.length} ticker(s) (${names(viaNasdaq)}); Nasdaq's public history was used for them`);
if (report.conflicts.length) report.flags.push(`A source restated ${report.conflicts.length} stored bar(s); the stored values were kept (see conflicts)`);
const has = (t, d) => bars[t].some((b) => b[0] === d);
if (!has('SPY', D)) finish(failed.includes('SPY') ? 1 : 0, failed.includes('SPY') ? 'fetch error' : `SPY bar for ${D} not published yet`);

// ---- 2. second source: StockAnalysis closes for D ----------------------------------------------------------------------
async function stockAnalysis(t) {
  if (OFFLINE) { const p = join(OFFLINE, `sa-${t}.html`); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
  const r = await fetch(`https://stockanalysis.com/etf/${t.toLowerCase()}/history/`, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'text/html' } });
  return r.ok ? r.text() : null;
}
const verdict = {};   // ticker -> 'checked' | 'unchecked' | 'disagree'
for (const t of US_TICKERS) {
  if (!has(t, D)) continue;
  try {
    const html = await stockAnalysis(t);
    const sa = html ? parseStockAnalysis(html) : {};
    const mine = bars[t].find((b) => b[0] === D)[4];
    verdict[t] = sa[D] === undefined ? 'unchecked' : agree(mine, sa[D]) ? 'checked' : 'disagree';
    if (verdict[t] === 'disagree') report.flags.push(`${t}: Tiingo close ${mine} and StockAnalysis ${Number(sa[D].toFixed(2))} differ by more than 0.1%; ${D} not written for it`);
  } catch { verdict[t] = 'unchecked'; }
  if (!OFFLINE) await sleep(300);
}
const unchecked = Object.entries(verdict).filter(([, v]) => v === 'unchecked').map(([t]) => t);
if (unchecked.length) report.flags.push(`${unchecked.length} close(s) not cross-checked against a second source (${names(unchecked)}): StockAnalysis had no row for ${D}`);
const usable = (t) => has(t, D) && verdict[t] !== 'disagree';

// ---- 3. VIX ------------------------------------------------------------------------------------------------------------
let vix = null;
try {
  const csv = OFFLINE ? (existsSync(join(OFFLINE, 'cboe.csv')) ? readFileSync(join(OFFLINE, 'cboe.csv'), 'utf8') : '') : await (await fetch('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv')).text();
  const v = parseCboeVix(csv);
  if (v[D] !== undefined) vix = v[D]; else report.flags.push(`VIX: Cboe has no row for ${D} yet`);
  const prev = cal.prevSession(D);
  if (!OFFLINE && process.env.FRED_KEY && v[prev] !== undefined) {
    const j = await (await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&observation_start=${prev}&observation_end=${prev}&file_type=json&api_key=${process.env.FRED_KEY}`)).json();
    const f = Number(j.observations?.[0]?.value);
    if (Number.isFinite(f) && !agree(v[prev], f, 0.005)) report.flags.push(`VIX for ${prev}: Cboe ${v[prev]} and FRED ${f} differ`);
  }
} catch (e) { report.flags.push(`VIX not read: ${e.message}`); }

// ---- 4. documents -------------------------------------------------------------------------------------------------------
const SRC = 'Tiingo EOD, split-adjusted; close checked against StockAnalysis';
function docsFor(date, checked) {
  const st = Object.fromEntries(US_TICKERS.map((t) => [t, bars[t].some((b) => b[0] === date) ? usStats(bars[t], date) : null]));
  if (!st.SPY || !st.QQQ) return null;
  const sectors = {};
  for (const [t, key] of SECTORS) {
    const s = st[t]; if (!s || (checked && !usable(t))) continue;
    const e = { close: s.close, r1m: s.r1m, r3m: s.r3m, sma50: s.sma50, sma200: s.sma200 };
    for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
    sectors[key] = e;
  }
  const bench = {}; if (st.SPY.r1m !== undefined) bench.r1m = st.SPY.r1m; if (st.SPY.r3m !== undefined) bench.r3m = st.SPY.r3m;
  const b = { close: st.QQQ.close }; if (st.QQQ.sma50 !== undefined) b.sma50 = st.QQQ.sma50; if (st.QQQ.sma200 !== undefined) b.sma200 = st.QQQ.sma200;
  const tracker = { close: st.SPY.close, high: st.SPY.high, low: st.SPY.low, volume: st.SPY.volume, b };
  if (st.SPY.sma50 !== undefined) tracker.sma50 = st.SPY.sma50; if (st.SPY.sma200 !== undefined) tracker.sma200 = st.SPY.sma200;
  const brk = US_TICKERS.filter((t) => st[t]?.breaks.length);
  return { tracker, bench, sectors, breaks: brk, stats: st };
}
const main = docsFor(D, true);
if (!main || !usable('SPY') || !usable('QQQ')) finish(1, 'SPY or QQQ could not be confirmed');
const missing = SECTORS.filter(([, k]) => !(k in main.sectors)).map(([t]) => t);
const prevFeed = read(join(DIR, 'feed', 'latest.json'), null);
const sectors = { ...main.sectors };
if (missing.length) {   // keep the previous values for a sector we cannot confirm today, with its own date, and say so
  for (const [t, k] of SECTORS) if (missing.includes(t) && prevFeed?.sectors?.[k]) sectors[k] = prevFeed.sectors[k];
  report.flags.push(`${missing.length} sector ETF(s) not updated for ${D} (${names(missing)}): previous values kept with their own dates`);
}
for (const k of Object.keys(sectors)) sectors[k] = { date: sectors[k].date ?? D, ...sectors[k], sma200Src: 'computed from stored closes', src: SRC };
if (main.breaks.length) report.flags.push(`price break(s) in the adjusted history of ${names(main.breaks)}: averages that cross one are left out`);
const fetchedAt = new Date().toISOString();
write(join(DIR, 'feed', 'latest.json'), { date: D, fetchedAt, bench: main.bench, sectors, flags: report.flags.slice() });
const trackerPath = join(DIR, 'tracker', `${D}.json`);
const trackerDoc = { ...read(trackerPath, {}), ...main.tracker, ...(vix !== null ? { vix } : {}), src: 'Tiingo EOD (SPY, QQQ), split-adjusted; Cboe (VIX)', fetchedAt, flags: report.flags.filter((f) => /^(SPY|QQQ|VIX)/.test(f)) };
write(trackerPath, trackerDoc);
write(join(DIR, 'feed_hist', `${D}.json`), { date: D, bench: main.bench, sectors: Object.fromEntries(Object.entries(sectors).map(([k, v]) => [k, Object.fromEntries(['close', 'sma50', 'sma200', 'r1m', 'r3m'].filter((f) => v[f] !== undefined).map((f) => [f, v[f]]))])) });

// stored closes (split-adjusted, 260 dates per ticker), the app's "closes" document
const closes = {};
for (const t of US_TICKERS) { const s = adjustedThrough(bars[t], D); closes[t] = Object.fromEntries(s.dates.slice(-260).map((d, i, a) => [d, Math.round(s.close[s.dates.length - a.length + i] * 10000) / 10000])); }
write(join(DIR, 'closes.json'), { asOf: D, basis: 'split-adjusted closes; dividends not adjusted', closes }, false);

// ---- 5. earlier sessions (tracker and feed_hist docs the regime needs), written only if absent --------------------------
const spyDates = bars.SPY.map((b) => b[0]).filter((d) => d < D);
let filled = 0;
for (const d of spyDates.slice(-BACKFILL)) {
  const tp = join(DIR, 'tracker', `${d}.json`), fp = join(DIR, 'feed_hist', `${d}.json`);
  if (existsSync(tp) && existsSync(fp)) continue;
  const x = docsFor(d, false); if (!x) continue;
  if (!existsSync(tp)) write(tp, { ...x.tracker, src: 'Tiingo EOD, split-adjusted (not cross-checked)', fetchedAt });
  if (!existsSync(fp)) write(fp, { date: d, bench: x.bench, sectors: Object.fromEntries(Object.entries(x.sectors).map(([k, v]) => [k, v])) });
  filled++;
}
report.backfilled = filled;
report.flags.push(`${Object.keys(sectors).length} of ${SECTORS.length} sectors, SPY and QQQ written for ${D}${vix !== null ? `, VIX ${vix}` : ''}`);
finish(0, 'written');
