// One-off: three open questions about Massive (Polygon) grouped daily bars on the free plan, before a whole-market US scan relies on it.
//   1. History depth: which past dates does the free plan serve (plan says 2 years)?
//   2. Delisted names: does a past date list tickers that have since left the market (WBA, JNPR, ANSS were delisted in 2025)?
//   3. Adjustment: for a past date before a known split (ORLY 15-for-1, June 2025), is the adjusted close the raw close divided by the split?
// The free plan allows 5 calls a minute, so calls are spaced 13 seconds apart. The key is never written out.
import { writeFileSync } from 'node:fs';
const key = process.env.POLYGON_KEY;
if (!key) { console.error('POLYGON_KEY missing'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ts: new Date().toISOString(), depth: [], delisted: {}, adjustment: null, splits: null, errors: [] };
async function call(path) {
  await sleep(13000);
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`https://api.polygon.io${path}${sep}apiKey=${key}`);
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, j, msg: j ? (j.message || j.error || j.status || '') : txt.slice(0, 160) };
}
const grouped = (date, adjusted) => call(`/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=${adjusted}`);
const iso = (d) => d.toISOString().slice(0, 10);
const weekday = (d) => { while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1); return d; };
const back = (days) => weekday(new Date(Date.now() - days * 86400000));

// 1. depth
let pastRows = null; const pastDate = '2025-03-04';
for (const [label, d] of [['1y', iso(back(365))], ['18m', iso(back(548))], ['23m', iso(back(700))], ['25m', iso(back(760))], ['3y', iso(back(1095))], ['5y', iso(back(1825))], ['2020-03-16', '2020-03-16']]) {
  const g = await grouped(d, 'false');
  out.depth.push({ label, date: d, status: g.status, rows: g.j?.resultsCount ?? null, note: g.status === 200 ? '' : String(g.msg).slice(0, 160) });
}
// 2. delisted: names delisted in 2025 should appear on a past date and not today
const names = ['WBA', 'JNPR', 'ANSS', 'AAPL'];
const past = await grouped(pastDate, 'false');
const now = await grouped(iso(back(1)), 'false');
const has = (g, t) => (g.j?.results ?? []).some((x) => x.T === t);
out.delisted = { pastDate, nowDate: iso(back(1)), pastStatus: past.status, pastRows: past.j?.resultsCount ?? null, nowRows: now.j?.resultsCount ?? null, onPastDate: Object.fromEntries(names.map((t) => [t, has(past, t)])), onNowDate: Object.fromEntries(names.map((t) => [t, has(now, t)])) };
// 3. adjustment around ORLY's June 2025 15-for-1 split (check both a pre-split date and the split reference)
const d0 = '2025-06-06';
const raw = await grouped(d0, 'false'); const adj = await grouped(d0, 'true');
const row = (g) => (g.j?.results ?? []).find((x) => x.T === 'ORLY');
out.adjustment = { date: d0, rawStatus: raw.status, adjStatus: adj.status, rawClose: row(raw)?.c ?? null, adjClose: row(adj)?.c ?? null, ratio: row(raw) && row(adj) ? Math.round((row(raw).c / row(adj).c) * 100) / 100 : null };
const sp = await call('/v3/reference/splits?ticker=ORLY&limit=5');
out.splits = { status: sp.status, results: (sp.j?.results ?? []).slice(0, 5).map((x) => ({ date: x.execution_date, from: x.split_from, to: x.split_to })), note: sp.status === 200 ? '' : String(sp.msg).slice(0, 160) };
writeFileSync('data/source-test/massive-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
