// One-off: StockAnalysis ETF holdings table and a stock statistics page (labels for the next earnings date etc.).
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: 'text/html' };
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '|').replace(/\|[\s|]*\|/g, '|').replace(/\s+/g, ' ');
const out = {};
let r = await fetch('https://stockanalysis.com/etf/xle/holdings/', { headers: H }); let h = await r.text();
const rows = [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim()));
out.etfConstituents = { status: r.status, header: rows[0], rows: rows.slice(1, 13), n: rows.length, asOf: (/[Aa]s of ([A-Z][a-z]+ \d+, \d{4})/.exec(text(h)) || [])[1] };
for (const s of ['xom', 'nvda']) {
  r = await fetch(`https://stockanalysis.com/stocks/${s}/statistics/`, { headers: H }); h = await r.text(); const t = text(h);
  const grab = (label) => { const i = t.indexOf(label); return i < 0 ? 'ABSENT' : t.slice(i, i + 90); };
  out[s] = { status: r.status, size: h.length, fiftyTwo: grab('52-Week Price Change'), ma50: grab('50-Day Moving Average'), ma200: grab('200-Day Moving Average'), avgVol: grab('Average Volume'), earnings: grab('Earnings Date'), nextEarn: grab('Next Earnings') };
  r = await fetch(`https://stockanalysis.com/stocks/${s}/`, { headers: H }); h = await r.text(); const t2 = text(h);
  const i = t2.indexOf('Earnings Date'); out[s].overviewEarnings = i < 0 ? 'ABSENT' : t2.slice(i, i + 80);
}
writeFileSync('data/source-test/us-probe3.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out).slice(0, 3500));
