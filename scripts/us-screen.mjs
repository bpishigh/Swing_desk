// Repo Desk weekly US stock screen. Reads data/us/feed/latest.json (written by us-nightly), picks the top sectors, takes each sector ETF's
// top 10 holdings from StockAnalysis, computes every stock's metrics from Tiingo history, and writes data/us/screen/latest.json.
// Usage: node scripts/us-screen.mjs [--dir=data/us] [--offline=<folder>]
//   --offline reads holdings-<ETF>.html, <SYM>.json (Tiingo reply) and stats-<SYM>.html from the folder.
// Needs TIINGO_KEY. One fetch at a time; stops on HTTP 403/407/429 and writes what it has, with a flag.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nasdaqBars } from './nasdaq.mjs';
import { parseTiingo } from '../src/ingest/us-eod.ts';
import { pickSectors, parseHoldings, parseStats, stockMetrics, commonDate } from '../src/ingest/us-screen.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const DIR = arg('dir') || 'data/us';
const OFFLINE = arg('offline');
const KEY = process.env.TIINGO_KEY;
const MAX_STOCKS = 40;   // Tiingo free plan: about 50 requests an hour; past that, Nasdaq's public history takes over (identical numbers)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const write = (p, o) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(o, null, 1) + '\n'); };
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const report = { ts: new Date().toISOString(), status: 'unknown', sectors: [], stocks: 0, skipped: [], flags: [] };
const finish = (code, status) => { report.status = status; write(join(DIR, 'screen', 'last-run.json'), report); console.log(JSON.stringify(report).slice(0, 2500)); process.exit(code); };
if (!OFFLINE && !KEY) { report.flags.push('TIINGO_KEY is not set'); finish(1, 'no key'); }

const feedPath = join(DIR, 'feed', 'latest.json');
if (!existsSync(feedPath)) { report.flags.push('no US feed yet (run us-nightly first)'); finish(1, 'no feed'); }
const feed = JSON.parse(readFileSync(feedPath, 'utf8'));
const picks = pickSectors(feed);
report.sectors = picks.map((p) => p.etf);
const doc = (date, stocks, flags) => ({ date, feedDate: feed.date, fetchedAt: new Date().toISOString(), sectors: picks.map((p) => p.etf), source: 'StockAnalysis holdings and statistics; Tiingo history', flags, stocks });
if (!picks.length) {
  report.flags.push('no sector passes the gate (r3m above the benchmark and close above the 50 SMA)');
  write(join(DIR, 'screen', 'latest.json'), doc(feed.date, [], report.flags.slice()));
  finish(0, 'no sectors pass');
}

let blocked = false;
async function page(url, offlineName) {
  if (OFFLINE) { const p = join(OFFLINE, offlineName); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
  if (blocked) return null;
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if ([403, 407, 429].includes(r.status)) { blocked = true; report.flags.push(`StockAnalysis returned ${r.status}; fetching stopped`); return null; }
  return r.ok ? r.text() : null;
}
const viaNasdaq = [];
async function tiingo(sym, start) {
  if (OFFLINE) { const p = join(OFFLINE, `${sym}.json`); return existsSync(p) ? { rows: JSON.parse(readFileSync(p, 'utf8')) } : null; }
  if (!tiingoDown) {
    const r = await fetch(`https://api.tiingo.com/tiingo/daily/${sym.toLowerCase().replace('.', '-')}/prices?startDate=${start}&token=${KEY}`);
    if (r.ok) return { rows: await r.json() };
    if (r.status === 429) { tiingoDown = true; report.flags.push('Tiingo returned 429 (hourly limit); Nasdaq\'s public history used for the rest'); }
  }
  try { const g = await nasdaqBars(sym, 'stocks', start); viaNasdaq.push(sym); return { bars: g.bars }; } catch { return null; }
}
let tiingoDown = process.env.BACKUP_ONLY === '1';   // test hook: use the Nasdaq path only

// 2. holdings, one fetch per ETF; a stock under two ETFs stays under the first
const chosen = []; const seen = new Set();
for (const p of picks) {
  const html = await page(`https://stockanalysis.com/etf/${p.etf.toLowerCase()}/holdings/`, `holdings-${p.etf}.html`);
  const hs = html ? parseHoldings(html) : [];
  if (!hs.length) report.flags.push(`${p.etf}: holdings not read`);
  for (const h of hs) if (!seen.has(h.symbol)) { seen.add(h.symbol); chosen.push({ ...h, etf: p.etf }); }
  if (!OFFLINE) await sleep(500);
}
if (chosen.length > MAX_STOCKS) { report.flags.push(`${chosen.length - MAX_STOCKS} holdings beyond the ${MAX_STOCKS}-stock limit were not screened`); chosen.length = MAX_STOCKS; }

// 3-4. per stock
const D0 = feed.date;
const start = new Date(Date.parse(D0) - 420 * 864e5).toISOString().slice(0, 10);
const stocks = [];
for (const h of chosen) {
  const got = await tiingo(h.symbol, start);
  if (!got) { report.skipped.push(`${h.symbol}: no history`); continue; }
  let bars; try { bars = got.bars || parseTiingo(got.rows).bars; } catch { report.skipped.push(`${h.symbol}: unreadable history`); continue; }
  const sHtml = await page(`https://stockanalysis.com/stocks/${h.symbol.toLowerCase().replace('.', '-')}/statistics/`, `stats-${h.symbol}.html`);
  const stats = sHtml ? parseStats(sHtml) : { earnings: null };
  const m = stockMetrics(bars, h.symbol, h.etf, h.weight, stats);
  if (!m) { report.skipped.push(`${h.symbol}: under 40 rows`); continue; }
  if (!sHtml) m.flags.push('StockAnalysis statistics page not read');
  if (Number.isNaN(m.volRatio)) { delete m.volRatio; m.flags.push('volume ratio needs 21 bars'); }
  stocks.push(m);
  if (!OFFLINE) await sleep(500);
}
if (report.skipped.length) report.flags.push(`${report.skipped.length} stock(s) skipped (no history or under 40 rows)`);
const date = commonDate(stocks);
if (date && date < feed.date) report.flags.push(`stock history ends ${date}, but the sector feed is dated ${feed.date}`);
report.stocks = stocks.length;
const noEarn = stocks.filter((s) => s.earnings === null).length;
if (noEarn) report.flags.push(`${noEarn} stock(s) have no next earnings date`);
if (viaNasdaq.length) report.flags.push(`${viaNasdaq.length} stock(s) screened from Nasdaq's public history instead of Tiingo`);
if (!stocks.length) { report.flags.push('no stock could be screened; the previous screen is kept'); finish(1, 'no stocks'); }
const out = doc(date, stocks, report.flags.slice());
write(join(DIR, 'screen', 'latest.json'), out);
write(join(DIR, 'screen', `${date}.json`), out);
finish(0, 'written');
