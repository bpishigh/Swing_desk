// One-off: is Yahoo (or Stooq) usable from the runner as a second price/volume source for the weekly screen, and which 52-week definition
// does StockAnalysis use? Compares each against the stored screen (computed from Tiingo) and the StockAnalysis statistics page.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseStats } from '../src/ingest/us-screen.ts';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const scr = JSON.parse(readFileSync('data/us/screen/latest.json', 'utf8'));
const pick = scr.stocks.filter((_, i) => i % 3 === 0).slice(0, 13);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const r2 = (x) => Math.round(x * 100) / 100;
const back = (d, days) => new Date(Date.parse(d) - days * 864e5).toISOString().slice(0, 10);
const monthsBack = (d, m) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() - m); return t.toISOString().slice(0, 10); };
const atOrBefore = (dates, t) => { let k = -1; for (let i = 0; i < dates.length; i++) if (dates[i] <= t) k = i; else break; return k; };
const out = { ts: new Date().toISOString(), stooq: null, rows: [] };
{
  const r = await fetch('https://stooq.com/q/d/l/?s=aapl.us&i=d', { headers: { 'user-agent': UA } });
  const t = await r.text(); out.stooq = { status: r.status, head: t.slice(0, 160), lines: t.split('\n').length };
}
for (const s of pick) {
  const row = { sym: s.sym, stored: { close: s.close, chg52: s.chg52, avgVol: s.avgVol, date: s.date } };
  try {
    const sa = await fetch(`https://stockanalysis.com/stocks/${s.sym.toLowerCase().replace('.', '-')}/statistics/`, { headers: { 'user-agent': UA, accept: 'text/html' } });
    const st = sa.ok ? parseStats(await sa.text()) : null; row.page = { status: sa.status, chg52: st?.chg52, avgVol: st?.avgVol, ma50: st?.ma50 };
  } catch (e) { row.page = { error: String(e).slice(0, 80) }; }
  try {
    const y = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.sym)}?range=2y&interval=1d&events=div%7Csplit`, { headers: { 'user-agent': UA } });
    if (!y.ok) { row.yahoo = { status: y.status }; }
    else {
      const j = await y.json(); const res = j.chart.result[0];
      const q = res.indicators.quote[0], adj = res.indicators.adjclose?.[0]?.adjclose || [];
      const dates = res.timestamp.map((t) => new Date(t * 1000).toISOString().slice(0, 10));
      const keep = dates.map((d, i) => i).filter((i) => q.close[i] != null);
      const D = keep.map((i) => dates[i]), C = keep.map((i) => q.close[i]), V = keep.map((i) => q.volume[i]), A = keep.map((i) => adj[i]);
      const n = D.length, last = D[n - 1];
      const ch = (arr, t) => { const k = atOrBefore(D, t); return k < 0 ? null : r2((arr[n - 1] / arr[k] - 1) * 100); };
      row.yahoo = { status: 200, rows: n, last, close: r2(C[n - 1]), avgVol: Math.round(mean(V.slice(-20))),
        chg52_12m: ch(C, monthsBack(last, 12)), chg52_364d: ch(C, back(last, 364)), chg52_365d: ch(C, back(last, 365)), chg52_adj12m: A.some((x) => x == null) ? null : ch(A, monthsBack(last, 12)),
        chg52_252s: n > 252 ? r2((C[n - 1] / C[n - 253] - 1) * 100) : null };
    }
  } catch (e) { row.yahoo = { error: String(e).slice(0, 80) }; }
  out.rows.push(row);
  await new Promise((r) => setTimeout(r, 1200));
}
writeFileSync('data/source-test/us-backup-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.stooq)); for (const r of out.rows) console.log(r.sym, JSON.stringify(r.stored), JSON.stringify(r.page), JSON.stringify(r.yahoo));
