// One-off: Nasdaq's public historical-quotes API and StockAnalysis's history page as keyless backup sources for US daily bars.
// Each is turned into bars, run through the same metrics as the Tiingo path and compared with the stored screen.
import { readFileSync, writeFileSync } from 'node:fs';
import { stockMetrics } from '../src/ingest/us-screen.ts';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const scr = JSON.parse(readFileSync('data/us/screen/latest.json', 'utf8'));
const pick = scr.stocks.filter((_, i) => i % 3 === 0).slice(0, 13);
const fields = ['close', 'sma50', 'sma200', 'ema20', 'atr14', 'high50', 'low10', 'r1m', 'avgVol', 'volRatio', 'chg52'];
const money = (s) => Number(String(s).replace(/[$,]/g, ''));
const iso = (mdy) => { const [m, d, y] = mdy.split('/'); return `${y}-${m}-${d}`; };
const out = { ts: new Date().toISOString(), nasdaq: [], etf: null, saHistory: null };
const pct = (a, b) => (typeof a === 'number' && typeof b === 'number' && b !== 0 ? Math.round(Math.abs(a / b - 1) * 10000) / 100 : null);
async function nasdaq(sym, cls = 'stocks') {
  const r = await fetch(`https://api.nasdaq.com/api/quote/${sym}/historical?assetclass=${cls}&fromdate=2025-08-01&todate=2026-10-10&limit=9999`, { headers: { 'user-agent': UA, accept: 'application/json, text/plain, */*', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' } });
  if (!r.ok) return { status: r.status };
  const j = await r.json(); const rows = j?.data?.tradesTable?.rows;
  if (!Array.isArray(rows)) return { status: r.status, shape: Object.keys(j || {}).join(','), msg: JSON.stringify(j?.status || j?.message || '').slice(0, 120) };
  const bars = rows.map((x) => [iso(x.date), money(x.open), money(x.high), money(x.low), money(x.close), money(x.volume), 1, 0]).filter((b) => b.slice(1, 6).every(Number.isFinite)).sort((a, b) => a[0].localeCompare(b[0]));
  return { status: 200, bars };
}
for (const s of pick) {
  const g = await nasdaq(s.sym);
  if (!g.bars) { out.nasdaq.push({ sym: s.sym, status: g.status, shape: g.shape, msg: g.msg }); await new Promise((r) => setTimeout(r, 1500)); continue; }
  const m = stockMetrics(g.bars, s.sym, s.sector, s.weight, { earnings: null });
  const diff = {}; for (const f of fields) diff[f] = pct(m?.[f], s[f]);
  out.nasdaq.push({ sym: s.sym, status: 200, rows: g.bars.length, last: g.bars.at(-1)[0], diffPct: diff, mine: { chg52: m?.chg52, avgVol: m?.avgVol }, stored: { chg52: s.chg52, avgVol: s.avgVol } });
  await new Promise((r) => setTimeout(r, 1500));
}
{ const g = await nasdaq('SPY', 'etf'); out.etf = g.bars ? { status: 200, rows: g.bars.length, last: g.bars.at(-1), first: g.bars[0][0] } : g; }
{
  const r = await fetch('https://stockanalysis.com/stocks/aapl/history/', { headers: { 'user-agent': UA, accept: 'text/html' } });
  const t = r.ok ? await r.text() : '';
  out.saHistory = { status: r.status, tableRows: (t.match(/<tr/g) || []).length, jsonRows: (t.match(/"c":[\d.]+/g) || []).length, hasVolume: /"v":\d+/.test(t) };
}
writeFileSync('data/source-test/us-backup-probe2.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.etf), JSON.stringify(out.saHistory));
for (const r of out.nasdaq) console.log(r.sym, r.status, r.rows, r.last, JSON.stringify(r.diffPct), JSON.stringify(r.mine), JSON.stringify(r.stored));
