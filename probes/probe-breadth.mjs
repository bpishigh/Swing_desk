// One-off: can the constituent lists for breadth be fetched? NSE Nifty 500 list (archives host) and the S&P 500 list (StockAnalysis, Nasdaq screener).
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const out = { ts: new Date().toISOString() };
async function get(name, url, headers = {}) {
  try { const r = await fetch(url, { headers: { 'user-agent': UA, ...headers } }); const t = await r.text(); out[name] = { status: r.status, bytes: t.length, head: t.slice(0, 200).replace(/\s+/g, ' ') }; return r.ok ? t : null; }
  catch (e) { out[name] = { error: String(e).slice(0, 100) }; return null; }
}
const n500 = await get('nifty500', 'https://archives.nseindia.com/content/indices/ind_nifty500list.csv');
if (n500) { const syms = n500.trim().split('\n').slice(1).map((l) => l.split(',')[2]).filter(Boolean); out.nifty500 = { ...out.nifty500, count: syms.length, symbols: syms }; }
const sa = await get('saSp500', 'https://stockanalysis.com/list/sp-500-stocks/', { accept: 'text/html' });
if (sa) { const syms = [...new Set([...sa.matchAll(/href="\/stocks\/([a-z.\-]+)\/"/g)].map((m) => m[1].toUpperCase()))]; out.saSp500 = { ...out.saSp500, count: syms.length, symbols: syms }; }
await get('wikiSp500', 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies');
writeFileSync('data/source-test/breadth-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.nifty500?.count, out.saSp500?.count, out.nifty500?.status, out.saSp500?.status, out.wikiSp500?.status);
