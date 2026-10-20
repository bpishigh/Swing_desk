// One-off: recompute the Claude Desk's screen of 1 Oct 2026 from Tiingo history and compare field by field.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTiingo } from '../src/ingest/us-eod.ts';
import { stockMetrics } from '../src/ingest/us-screen.ts';
const key = process.env.TIINGO_KEY;
const fx = JSON.parse(readFileSync('fixtures/db/us_screen/latest.json', 'utf8'));
const asOf = fx.date;
const fields = ['close', 'sma50', 'sma200', 'ema20', 'atr14', 'high50', 'high1', 'low10', 'low3', 'r1m', 'avgVol', 'adv', 'volRatio', 'chg52'];
const rows = []; const sums = Object.fromEntries(fields.map((f) => [f, { n: 0, sumAbsPct: 0, maxAbsPct: 0, worst: '' }]));
for (const e of fx.stocks) {
  const r = await fetch(`https://api.tiingo.com/tiingo/daily/${e.sym.toLowerCase().replace('.', '-')}/prices?startDate=2025-05-01&endDate=${asOf}&token=${key}`);
  if (!r.ok) { rows.push({ sym: e.sym, error: r.status }); if (r.status === 429) break; continue; }
  const bars = parseTiingo(await r.json()).bars;
  const m = stockMetrics(bars, e.sym, e.sector, e.weight, { earnings: null });
  if (!m) { rows.push({ sym: e.sym, error: 'short' }); continue; }
  const d = { sym: e.sym, date: m.date };
  for (const f of fields) {
    if (typeof e[f] !== 'number' || typeof m[f] !== 'number') continue;
    const pct = e[f] === 0 ? 0 : (m[f] / e[f] - 1) * 100;
    d[f] = [e[f], m[f], Math.round(pct * 100) / 100];
    const s = sums[f]; s.n++; s.sumAbsPct += Math.abs(pct); if (Math.abs(pct) > s.maxAbsPct) { s.maxAbsPct = Math.abs(pct); s.worst = e.sym; }
  }
  rows.push(d);
  await new Promise((s) => setTimeout(s, 400));
}
const summary = Object.fromEntries(Object.entries(sums).map(([f, s]) => [f, { n: s.n, meanAbsPct: s.n ? Math.round((s.sumAbsPct / s.n) * 1000) / 1000 : null, maxAbsPct: Math.round(s.maxAbsPct * 100) / 100, worst: s.worst }]));
writeFileSync('data/source-test/screen-parity.json', JSON.stringify({ asOf, stocks: fx.stocks.length, summary, rows }, null, 1) + '\n');
console.log(JSON.stringify(summary));
