// One-off: how far back can free sources go for US stocks, and do delisted tickers appear? Counts and dates only.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const out = { ts: new Date().toISOString(), nasdaq: [], tiingo: [], massive: [], other: [] };
const nas = async (sym, from) => {
  try { const r = await fetch(`https://api.nasdaq.com/api/quote/${sym}/historical?assetclass=stocks&fromdate=${from}&todate=2026-10-16&limit=9999`, { headers: { 'user-agent': UA, accept: 'application/json, text/plain, */*', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' } });
    const j = await r.json().catch(() => null); const rows = j?.data?.tradesTable?.rows || []; return { sym, from, status: r.status, rows: rows.length, oldest: rows.at(-1)?.date ?? null, newest: rows[0]?.date ?? null, msg: j?.status?.bCodeMessage?.[0]?.errorMessage ?? null }; } catch (e) { return { sym, from, err: e.message }; }
};
for (const [s, f] of [['AAPL', '2005-01-01'], ['AAPL', '2015-01-01'], ['SHLD', '2012-01-01'], ['BBBY', '2018-01-01'], ['TWTR', '2018-01-01'], ['SIVB', '2020-01-01'], ['GE', '2010-01-01']]) { out.nasdaq.push(await nas(s, f)); await new Promise((r) => setTimeout(r, 400)); }
const key = process.env.TIINGO_KEY;
if (key) for (const [s, f] of [['AAPL', '2005-01-01'], ['SHLD', '2012-01-01'], ['BBBY', '2018-01-01'], ['TWTR', '2018-01-01'], ['SIVB', '2020-01-01']]) {
  try { const r = await fetch(`https://api.tiingo.com/tiingo/daily/${s}/prices?startDate=${f}&endDate=2026-10-16&token=${key}`, { headers: { 'content-type': 'application/json' } }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} out.tiingo.push({ s, f, status: r.status, rows: Array.isArray(j) ? j.length : null, first: Array.isArray(j) ? j[0]?.date?.slice(0, 10) : null, last: Array.isArray(j) ? j.at(-1)?.date?.slice(0, 10) : null, msg: Array.isArray(j) ? '' : t.slice(0, 160) }); } catch (e) { out.tiingo.push({ s, err: e.message }); }
  await new Promise((r) => setTimeout(r, 1500));
} else out.tiingo.push('no TIINGO_KEY in this run');
const pk = process.env.POLYGON_KEY;
if (pk) for (const d of ['2023-10-16', '2020-10-16', '2015-10-16']) { try { const r = await fetch(`https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${d}?adjusted=true&apiKey=${pk}`); const j = await r.json().catch(() => ({})); out.massive.push({ d, status: r.status, n: j.resultsCount ?? null, msg: (j.message || j.error || '').slice(0, 120) }); } catch (e) { out.massive.push({ d, err: e.message }); } }
for (const [name, url] of [['stooq_aapl', 'https://stooq.com/q/d/l/?s=aapl.us&i=d'], ['cboe_vix', 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'], ['datalink_wiki', 'https://data.nasdaq.com/api/v3/datasets/WIKI/AAPL.json?rows=1'], ['marketparquet_manifest', 'https://marketparquet.com/api/data/download/stock_daily/latest.parquet']]) {
  try { const r = await fetch(url, { headers: { 'user-agent': UA } }); const t = await r.text(); out.other.push({ name, status: r.status, bytes: t.length, head: t.slice(0, 120).replace(/\s+/g, ' ') }); } catch (e) { out.other.push({ name, err: e.message }); }
}
import { writeFileSync, mkdirSync } from 'node:fs'; mkdirSync('data/source-test', { recursive: true }); writeFileSync('data/source-test/us-history-probe.json', JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out).slice(0, 4000));
