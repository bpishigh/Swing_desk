// One-off: for each ETF break, compare Yahoo's (split-adjusted) closes with NSE's raw closes either side of the break.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const lat = JSON.parse(readFileSync('data/india/stocks/latest.json', 'utf8'));
const etfs = lat.corporateActions.unresolved.filter((u) => /ETF unit split/.test(u.reason));
const files = readdirSync('data/india/bhav').sort();
const nse = {}; // symbol -> {date: close}
for (const f of files) { const d = JSON.parse(readFileSync('data/india/bhav/' + f, 'utf8')); for (const e of etfs) { const r = d.rows[e.symbol]; if (r) (nse[e.symbol] ??= {})[d.date] = r[5]; } }
const out = [];
for (const e of etfs) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${e.symbol}.NS?range=2y&interval=1d&events=splits`, { headers: { 'user-agent': UA } });
  const j = await r.json().catch(() => null);
  const res = j?.chart?.result?.[0]; const ts = res?.timestamp ?? []; const cl = res?.indicators?.quote?.[0]?.close ?? [];
  const y = {}; ts.forEach((t, i) => { if (cl[i] != null) y[new Date((t + 19800) * 1000).toISOString().slice(0, 10)] = cl[i]; });
  const dates = Object.keys(nse[e.symbol] ?? {}).sort(); const bi = dates.indexOf(e.date);
  const pick = (d) => (y[d] != null ? +(y[d] / nse[e.symbol][d]).toFixed(4) : null);
  out.push({ symbol: e.symbol, breakDate: e.date, nseRatio: e.ratio, before: pick(dates[bi - 1]), after: pick(dates[bi]), yahooDays: Object.keys(y).length, splits: res?.events?.splits ?? null });
  await new Promise((s) => setTimeout(s, 400));
}
writeFileSync('data/source-test/etf-probe2.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.map((o) => [o.symbol, o.breakDate, 'nse', o.nseRatio, 'y/nse before', o.before, 'after', o.after].join(' ')).join('\n'));
// NSE's ETF list: name and underlying for each break symbol
const lr = await fetch('https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv', { headers: { 'user-agent': UA } });
const lines = (await lr.text()).split(/\r?\n/);
const want = new Set(etfs.map((e) => e.symbol));
const rows = lines.filter((l) => want.has(l.split(',')[0]));
writeFileSync('data/source-test/etf-list-16.csv', lines[0] + '\n' + rows.join('\n') + '\n');
console.log(rows.map((r) => r.split(',').slice(0, 3).join(' | ') + ' | ' + r.split(',').slice(-2).join(' | ')).join('\n'));
