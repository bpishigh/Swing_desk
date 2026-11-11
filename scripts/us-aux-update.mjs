// Nightly inputs for the US first-wave books (Engine Rules C-179 items 6 and 7): (1) the 3-month Treasury yield for the cash credit, FRED DGS3MO with the Treasury's own daily table as fallback,
// (2) SPY, QQQ and MTUM daily bars from Nasdaq (price only, split-adjusted, no dividends), appended to data/us/hist-bench/SYM.json.gz. Fails soft: a source that cannot be reached leaves the last stored data.
// Writes data/us/cash-rate.json = { source, asOf, series: { date: percent } }. Usage: node scripts/us-aux-update.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { nasdaqBars } from './nasdaq.mjs';
const UA = { 'User-Agent': 'swing-desk research (noreply@github.com)' }, R = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const cash = R('data/us/cash-rate.json', { source: null, asOf: null, series: {} });
const last = Object.keys(cash.series).sort().at(-1), since = last ? new Date(Date.parse(last) - 10 * 864e5).toISOString().slice(0, 10) : '2026-10-01';
let got = 0;
try {
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO&cosd=${since}`, { headers: UA }); if (!r.ok) throw new Error('FRED ' + r.status);
  for (const l of (await r.text()).trim().split('\n').slice(1)) { const [d, v] = l.split(','); if (/^\d{4}-\d\d-\d\d$/.test(d) && v && v !== '.' && Number(v) >= 0) { cash.series[d] = Number(v); got++; } }
  if (got) cash.source = 'FRED DGS3MO';
} catch (e) { console.error('FRED:', String(e).slice(0, 160)); }
// the Treasury's own table fills dates FRED has not published yet (FRED runs about a day behind) and is the fallback when FRED fails
try {
  const y = new Date().getUTCFullYear(), r = await fetch(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`, { headers: UA });
  if (!r.ok) throw new Error('Treasury ' + r.status);
  const L = (await r.text()).trim().split('\n'), h = L[0].split(',').map((x) => x.replace(/"/g, '')), i = h.findIndex((x) => /^3 Mo/.test(x)); if (i < 0) throw new Error('no 3 Mo column');
  for (const l of L.slice(1)) { const c = l.split(',').map((x) => x.replace(/"/g, '')), m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(c[0]), v = Number(c[i]); if (m && v >= 0 && c[i] !== '') { const d = `${m[3]}-${m[1]}-${m[2]}`; if (!(d in cash.series)) { cash.series[d] = v; if (!got) cash.source = 'Treasury daily yield table'; } } }
} catch (e) { console.error('Treasury:', String(e).slice(0, 160)); }
cash.asOf = Object.keys(cash.series).sort().at(-1) ?? null; mkdirSync('data/us', { recursive: true }); writeFileSync('data/us/cash-rate.json', JSON.stringify(cash) + '\n'); console.log('cash', cash.source, cash.asOf, Object.keys(cash.series).length);
mkdirSync('data/us/hist-bench', { recursive: true });
for (const s of ['SPY', 'QQQ', 'MTUM']) {
  const f = `data/us/hist-bench/${s}.json.gz`, old = existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString()) : null, from = old ? old.to : '2016-10-01';
  try {
    let g = null; for (let a = 0; a < 3 && !g; a++) { try { g = await nasdaqBars(s, 'etf', from); } catch (e) { if (a === 2) throw e; await new Promise((r) => setTimeout(r, 2000 * (a + 1))); } }
    const m = new Map((old?.bars ?? []).map((b) => [b[0], b])); for (const b of g?.bars ?? []) m.set(b[0], [b[0], b[4], b[2], b[3], b[5]]);
    const bars = [...m.values()].sort((x, y) => (x[0] < y[0] ? -1 : 1)); if (!bars.length) throw new Error('no bars');
    writeFileSync(f, gzipSync(JSON.stringify({ sym: s, from: bars[0][0], to: bars.at(-1)[0], src: 'nasdaq', bars }))); console.log(s, bars.length, bars.at(-1)[0]);
  } catch (e) { console.error(s, String(e).slice(0, 160)); }
}
