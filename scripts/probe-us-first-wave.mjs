// One-off probe (11 Nov 2026) for the US first-wave rules: can the GitHub runner reach (1) FRED's daily 3-month Treasury yield (DGS3MO), (2) the US Treasury's own daily yield table, (3) MTUM daily bars from Nasdaq?
// Writes data/probe-us-first-wave.json. Descriptive only: depth, last date, row count. Nothing is stored for use.
import { writeFileSync } from 'node:fs';
import { nasdaqBars } from './nasdaq.mjs';
const out = { at: new Date().toISOString() };
const tryGet = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = { ok: false, error: String(e).slice(0, 200) }; } };
await tryGet('fred_DGS3MO', async () => {
  const r = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO&cosd=2016-01-01', { headers: { 'User-Agent': 'swing-desk research (noreply@github.com)' } }); const t = await r.text();
  const rows = t.trim().split('\n').slice(1).map((l) => l.split(',')).filter((x) => x[1] && x[1] !== '.'); return { ok: r.ok, status: r.status, rows: rows.length, first: rows[0]?.[0], last: rows.at(-1)?.[0], lastValue: rows.at(-1)?.[1], head: t.slice(0, 60) };
});
await tryGet('treasury_yield_table', async () => {
  const r = await fetch('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv', { headers: { 'User-Agent': 'swing-desk research (noreply@github.com)' } }); const t = await r.text();
  const L = t.trim().split('\n'); const h = L[0].split(',').map((x) => x.replace(/"/g, '')); const i = h.findIndex((x) => /3 Mo/.test(x)); return { ok: r.ok, status: r.status, rows: L.length - 1, header: h.slice(0, 8), firstRow: L[1]?.split(',').slice(0, 2), col3Mo: i, lastRow3Mo: L[1]?.split(',')[i] };
});
await tryGet('mtum_bars', async () => { const g = await nasdaqBars('MTUM', 'etf', '2016-10-01'); const b = g?.bars ?? []; return { ok: b.length > 0, bars: b.length, first: b[b.length - 1]?.[0] ?? b[0]?.[0], last: b[0]?.[0], sample: b.slice(0, 2) }; });
writeFileSync('data/probe-us-first-wave.json', JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out).slice(0, 800));
