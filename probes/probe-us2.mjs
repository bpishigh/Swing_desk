// One-off: shape of the US second sources (StockAnalysis history table, Cboe VIX file, FRED VIXCLS).
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const out = {};
let r = await fetch('https://stockanalysis.com/etf/spy/history/', { headers: H }); let t = await r.text();
const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(0, 5).map((m) => m[1].replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/\s+/g, ' '));
out.sa = { status: r.status, size: t.length, rows, hasJson: /"history"|\\"h\\"|"data":\[\{"t"/.test(t), jsonSnippet: (/\{"t":"20\d\d-\d\d-\d\d"[^}]*\}/.exec(t) || [''])[0] };
r = await fetch('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', { headers: H }); t = await r.text();
const ls = t.trim().split(/\r?\n/); out.cboe = { status: r.status, head: ls.slice(0, 2), tail: ls.slice(-3) };
if (process.env.FRED_KEY) { r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&sort_order=desc&limit=4&file_type=json&api_key=${process.env.FRED_KEY}`); const j = await r.json(); out.fred = { status: r.status, obs: (j.observations || []).map((o) => [o.date, o.value]) }; }
r = await fetch('https://stockanalysis.com/etf/spy/holdings/', { headers: H }); t = await r.text();
out.etfConstituents = { status: r.status, rows: [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(0, 4).map((m) => m[1].replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/\s+/g, ' ')), asOf: (/as of ([A-Z][a-z]+ \d+, \d{4})/.exec(t) || [])[1] };
writeFileSync('data/source-test/us-probe2.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out).slice(0, 3000));
