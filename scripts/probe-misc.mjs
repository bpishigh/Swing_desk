// One-off probe (18 Oct 2026): (a) why 14 US symbols fail on Nasdaq history, (b) where to read next earnings dates (US and India). Writes data/source-test/misc-probe.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { nasdaqBars } from './nasdaq.mjs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*' };
const out = { hist: {}, earn: [] };
const from = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
for (const s of ['PBR.A', 'ET', 'MOG.A', 'DDS', 'BF.B', 'HEI.A', 'BH.A', 'TCBI', 'SUN', 'SUNC', 'UHAL.B', 'LEN.B', 'USAC', 'OBK']) {
  const tries = {};
  for (const [v, ac] of [[s, 'stocks'], [s.replace('.', '-'), 'stocks'], [s.replace('.', '/'), 'stocks'], [s.replace('.', ''), 'stocks'], [s, 'etf']]) {
    try { const g = await nasdaqBars(v, ac, from); tries[`${v}|${ac}`] = g.bars.length; } catch (e) { tries[`${v}|${ac}`] = String(e.message).slice(0, 40); }
  }
  out.hist[s] = tries;
}
const get = async (name, url, headers = {}) => { try { const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(25000) }); const t = await r.text(); out.earn.push({ name, status: r.status, bytes: t.length, head: t.slice(0, 600) }); } catch (e) { out.earn.push({ name, error: String(e.message) }); } };
await get('nasdaq earnings-date XOM', 'https://api.nasdaq.com/api/analyst/XOM/earnings-date', { origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' });
await get('nasdaq earnings calendar', `https://api.nasdaq.com/api/calendar/earnings?date=${new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)}`, { origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' });
await get('stockanalysis stats XOM', 'https://stockanalysis.com/stocks/xom/statistics/');
await get('NSE event calendar all', 'https://www.nseindia.com/api/event-calendar', { referer: 'https://www.nseindia.com/' });
await get('NSE event calendar symbol', 'https://www.nseindia.com/api/event-calendar?index=equities&symbol=RELIANCE', { referer: 'https://www.nseindia.com/' });
await get('NSE board meetings', 'https://www.nseindia.com/api/corporate-board-meetings?index=equities&symbol=RELIANCE', { referer: 'https://www.nseindia.com/' });
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/misc-probe.json', JSON.stringify(out, null, 1) + '\n');
