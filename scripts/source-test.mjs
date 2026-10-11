// Phase 0 source test. Probes candidate sources from the runner it executes on
// and appends one JSON line per probe to data/source-test/log.ndjson.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const now = new Date();
const ist = new Date(now.getTime() + 5.5 * 3600e3);
const pad = (n) => String(n).padStart(2, '0');
const ddmmyyyy = (d) => `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
// Previous session = previous weekday that is not an NSE holiday (data/calendar/markets-2026.json).
const HOLIDAYS = new Set(JSON.parse(readFileSync('data/calendar/markets-2026.json', 'utf8')).india.holidays);
const iso = (d) => d.toISOString().slice(0, 10);
const lastWeekday = (d) => { const x = new Date(d); do { x.setUTCDate(x.getUTCDate() - 1); } while ([0, 6].includes(x.getUTCDay()) || HOLIDAYS.has(iso(x))); return x; };
const yyyymmdd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const today = ddmmyyyy(ist);
const todayY = yyyymmdd(ist);
const prevY = yyyymmdd(lastWeekday(ist));
const prev = ddmmyyyy(lastWeekday(ist));

const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const NSE_H = { ...H, referer: 'https://www.nseindia.com/' };

const probes = [
  { id: 'nse_index_close_today', market: 'IN', url: `https://archives.nseindia.com/content/indices/ind_close_all_${today}.csv`, headers: NSE_H, kind: 'csv', nsePublication: true },
  { id: 'nse_index_close_prev', market: 'IN', url: `https://archives.nseindia.com/content/indices/ind_close_all_${prev}.csv`, headers: NSE_H, kind: 'csv' },
  { id: 'nse_bhavcopy_today', market: 'IN', url: `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${today}.csv`, headers: NSE_H, kind: 'csv', nsePublication: true },
  { id: 'nse_bhavcopy_prev', market: 'IN', url: `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${prev}.csv`, headers: NSE_H, kind: 'csv' },
  // Backups for the India files (Yahoo and Stooq removed 6 Oct 2026: 429/403 on every run from GitHub's servers).
  { id: 'nse_udiff_bhavcopy_today', market: 'IN', url: `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${todayY}_F_0000.csv.zip`, headers: NSE_H, kind: 'raw', nsePublication: true },
  { id: 'nse_udiff_bhavcopy_prev', market: 'IN', url: `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${prevY}_F_0000.csv.zip`, headers: NSE_H, kind: 'raw' },
  { id: 'bse_bhavcopy_today', market: 'IN', url: `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${todayY}_F_0000.CSV`, headers: { ...H, referer: 'https://www.bseindia.com/' }, kind: 'csv', nsePublication: true },
  { id: 'bse_bhavcopy_prev', market: 'IN', url: `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${prevY}_F_0000.CSV`, headers: { ...H, referer: 'https://www.bseindia.com/' }, kind: 'csv' },
  { id: 'nse_event_calendar', market: 'IN', url: 'https://www.nseindia.com/api/event-calendar', headers: NSE_H, kind: 'json' },
  { id: 'nse_nifty500_list', market: 'IN', url: 'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv', headers: NSE_H, kind: 'csv' },
  // VIX same-day candidates: FRED lags a day, so these are the fallback (the last line of the CSV shows the newest date).
  { id: 'cboe_vix_history', market: 'US', url: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', headers: H, kind: 'csv' },
  { id: 'stockanalysis_spy_history', market: 'US', url: 'https://stockanalysis.com/etf/spy/history/', headers: H, kind: 'html' },
  { id: 'stockanalysis_spy_holdings', market: 'US', url: 'https://stockanalysis.com/etf/spy/holdings/', headers: H, kind: 'html' },
];

// Keyed EOD APIs (free tiers). A probe runs only when its secret is set; otherwise it is skipped, not logged.
const lastUs = (() => { const x = new Date(now); do { x.setUTCDate(x.getUTCDate() - 1); } while ([0, 6].includes(x.getUTCDay())); return iso(x); })();
if (process.env.TIINGO_KEY) probes.push({ id: 'tiingo_spy', market: 'US', url: `https://api.tiingo.com/tiingo/daily/spy/prices?startDate=${lastUs}&token=${process.env.TIINGO_KEY}`, headers: H, kind: 'keyed' });
if (process.env.POLYGON_KEY) probes.push({ id: 'polygon_spy', market: 'US', url: `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/${lastUs}/${lastUs}?apiKey=${process.env.POLYGON_KEY}`, headers: H, kind: 'keyed' });
// History depth: the 200-day SMA needs 200+ closes, so ask for ~400 days and see how many rows the free plan returns.
const daysAgo = (n) => iso(new Date(now.getTime() - n * 864e5));
if (process.env.TIINGO_KEY) probes.push({ id: 'tiingo_spy_history', market: 'US', url: `https://api.tiingo.com/tiingo/daily/spy/prices?startDate=${daysAgo(400)}&token=${process.env.TIINGO_KEY}`, headers: H, kind: 'keyed' });
if (process.env.POLYGON_KEY) probes.push({ id: 'polygon_spy_history', market: 'US', url: `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/${daysAgo(400)}/${lastUs}?adjusted=false&limit=500&apiKey=${process.env.POLYGON_KEY}`, headers: H, kind: 'keyed' });
// VIX close from FRED (series VIXCLS), so VIX does not depend on the stock APIs.
// One-off: was 2 Jul 2026 an NYSE early close? An early close shows as about half the usual volume (adjusted=false). Delete once answered.
if (process.env.TIINGO_KEY) probes.push({ id: 'tiingo_spy_july', market: 'US', url: `https://api.tiingo.com/tiingo/daily/spy/prices?startDate=2026-06-24&endDate=2026-07-09&token=${process.env.TIINGO_KEY}`, headers: H, kind: 'keyed', vols: true });
// Massive/Polygon grouped daily: the whole US market's bars for one date in one call. Free plan? End of day or a session late? (rows and newest tell.)
if (process.env.POLYGON_KEY) probes.push({ id: 'polygon_grouped_daily', market: 'US', url: `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${lastUs}?adjusted=false&apiKey=${process.env.POLYGON_KEY}`, headers: H, kind: 'keyed', grouped: true });
if (process.env.FRED_KEY) probes.push({ id: 'fred_vix', market: 'US', url: `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&sort_order=desc&limit=5&file_type=json&api_key=${process.env.FRED_KEY}`, headers: H, kind: 'keyed' });
if (process.env.EODHD_KEY) probes.push({ id: 'eodhd_spy', market: 'US', url: `https://eodhd.com/api/eod/SPY.US?from=${lastUs}&fmt=json&api_token=${process.env.EODHD_KEY}`, headers: H, kind: 'keyed' });

// NSE live index tracker (same data the NSE index-tracker page shows). Needs the cookies the NSE home page sets.
let nseCookie = '';
try {
  const c0 = await fetch('https://www.nseindia.com/', { headers: H, redirect: 'follow' });
  nseCookie = (c0.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]).join('; ');
} catch { /* the probes below record the failure */ }
for (const [id, name] of [['nifty50', 'NIFTY%2050'], ['energy', 'NIFTY%20ENERGY'], ['defence', 'NIFTY%20IND%20DEFENCE']]) {
  probes.push({ id: `nse_tracker_${id}`, market: 'IN', url: `https://www.nseindia.com/api/NextApi/apiClient/indexTrackerApi?functionName=getIndexData&&index=${name}`, headers: { ...NSE_H, cookie: nseCookie }, kind: 'tracker', note: nseCookie ? 'cookie ok' : 'no cookie' });
}

function summarise(kind, text, p0) {
  const out = {};
  try {
    if (kind === 'csv') {
      const lines = text.split(/\r?\n/).filter(Boolean);
      out.rows = Math.max(0, lines.length - 1);
      out.header = lines[0]?.slice(0, 120);
      out.lastLine = lines[lines.length - 1]?.slice(0, 120);
      // The date INSIDE the file is what counts; NSE has served the previous session's data under a holiday's file name.
      const m = (lines[1] || '').match(/\d{2}-[A-Za-z]{3}-\d{4}|\d{2}-\d{2}-\d{4}/);
      out.dataDate = m ? m[0] : null;
      if (p0?.id?.startsWith('nse_index_close')) {
        const row = (n) => lines.find((l) => l.toLowerCase().startsWith(n.toLowerCase() + ','))?.split(',');
        out.nifty50Close = row('Nifty 50')?.[5] ?? null;
        out.indiaVixClose = row('India VIX')?.[5] ?? null;
      }
      if (p0?.id?.startsWith('nse_bhavcopy')) {
        const r = lines.find((l) => l.startsWith('RELIANCE, EQ,'))?.split(',').map((x) => x.trim());
        out.relianceClose = r?.[8] ?? null;
      }
    } else if (kind === 'raw') {
      out.rows = null;
    } else if (kind === 'tracker') {
      const j = JSON.parse(text);
      const d = (Array.isArray(j) ? j : j.data ? j.data : [j])[0] || {};
      out.indexName = d.indexName ?? null; out.last = d.last ?? null; out.timeVal = d.timeVal ?? null;
      out.rows = d.indexName ? 1 : 0;
    } else if (kind === 'json') {
      const j = JSON.parse(text);
      out.rows = Array.isArray(j) ? j.length : Object.keys(j).length;
    } else if (kind === 'yahoo') {
      const r = JSON.parse(text).chart?.result?.[0];
      const ts = r?.timestamp || [];
      out.rows = ts.length;
      out.newest = ts.length ? new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10) : null;
    } else if (kind === 'keyed') {
      const j = JSON.parse(text);
      const arr = Array.isArray(j) ? j : j.results || j.observations || [];
      out.rows = arr.length;
      // Newest row's date and close, whatever the vendor calls them (Tiingo date/close, Polygon t/c, EODHD date/close, FRED date/value).
      if (p0?.grouped) { out.queryCount = j.queryCount; out.resultsCount = j.resultsCount; }
      const rows = arr.map((r) => ({ d: r.date ? String(r.date).slice(0, 10) : r.t ? new Date(r.t).toISOString().slice(0, 10) : null, c: Number(r.close ?? r.c ?? r.value) })).filter((r) => r.d && Number.isFinite(r.c));
      rows.sort((a, b) => (a.d < b.d ? -1 : 1));
      const last = rows[rows.length - 1];
      if (p0?.vols) out.vols = arr.map((r) => `${String(r.date).slice(0, 10)}:${r.volume}`).join(' ');
      if (last) { out.newest = last.d; out.newestClose = last.c; out.oldest = rows[0].d; }
    } else if (kind === 'html') {
      out.rows = (text.match(/<tr/g) || []).length;
      out.hasTable = /<table/.test(text);
    }
  } catch (e) { out.parseError = String(e.message).slice(0, 100); }
  return out;
}

mkdirSync('data/source-test', { recursive: true });
const lines = [];
const results = {};
for (const p of probes) {
  const t0 = Date.now();
  const rec = { ts: now.toISOString(), istDate: today, id: p.id, market: p.market, url: p.url.replace(/(token|apiKey|api_token|api_key)=[^&]+/, '$1=***') };
  if (p.note) rec.note = p.note;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    const res = await fetch(p.url, { headers: p.headers, signal: ctl.signal, redirect: 'follow' });
    const buf = await res.text();
    clearTimeout(timer);
    rec.status = res.status;
    rec.bytes = buf.length;
    rec.ms = Date.now() - t0;
    rec.contentType = res.headers.get('content-type');
    if (res.ok) Object.assign(rec, summarise(p.kind, buf, p));
    else rec.bodyStart = buf.slice(0, 120).replace(/\s+/g, ' ');
    if (p.nsePublication) { rec.publishedNow = res.ok && buf.length > 500; rec.istTime = ist.toISOString().slice(11, 16); }
  } catch (e) {
    rec.status = 0;
    rec.error = String(e.cause?.code || e.message).slice(0, 120);
    rec.ms = Date.now() - t0;
  }
  lines.push(JSON.stringify(rec));
  results[rec.id] = rec;
  console.log(rec.id, rec.status, rec.bytes ?? '', rec.rows ?? '', rec.error ?? '');
  await new Promise((r) => setTimeout(r, 1500));
}
// Cross-check: do the free sources agree on the newest SPY close? (tolerance 0.1%; Tiingo is the primary, so differences are about trust, not truth.)
{
  const a = results.tiingo_spy, b = results.polygon_spy, c = results.eodhd_spy;
  const have = [['tiingo', a], ['polygon', b], ['eodhd', c]].filter(([, r]) => r && r.newestClose);
  if (have.length >= 2) {
    const base = have[0][1];
    const diffs = Object.fromEntries(have.slice(1).map(([n, r]) => [n, { sameDate: r.newest === base.newest, pctDiff: +(100 * (r.newestClose - base.newestClose) / base.newestClose).toFixed(3) }]));
    const agree = Object.values(diffs).every((d) => d.sameDate && Math.abs(d.pctDiff) <= 0.1);
    lines.push(JSON.stringify({ ts: now.toISOString(), istDate: today, id: 'us_close_crosscheck', market: 'US', base: have[0][0], baseDate: base.newest, baseClose: base.newestClose, diffs, agree }));
  }
}
appendFileSync('data/source-test/log.ndjson', lines.join('\n') + '\n');
