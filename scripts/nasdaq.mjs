// Backup price source: Nasdaq's public historical-quotes API (no key; prices already split-adjusted; volume matches Tiingo's consolidated figure).
// Checked on 10 Oct 2026 against Tiingo for 13 stocks: every screen metric identical.
import { parseNasdaq } from '../src/ingest/us-eod.ts';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
/** assetclass: 'stocks' or 'etf'. from/to: YYYY-MM-DD. Throws on any problem. */
export async function nasdaqBars(sym, assetclass, from, to = new Date().toISOString().slice(0, 10)) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(sym)}/historical?assetclass=${assetclass}&fromdate=${from}&todate=${to}&limit=9999`;
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json, text/plain, */*', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' } });
  if (!r.ok) throw new Error(`Nasdaq status ${r.status}`);
  return parseNasdaq(await r.json());
}
