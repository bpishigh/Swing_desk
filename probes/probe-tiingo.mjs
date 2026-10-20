// One-off: what exactly does Tiingo's free daily endpoint return (raw vs adjusted close, split and dividend fields, depth, limits)?
import { writeFileSync } from 'node:fs';
const key = process.env.TIINGO_KEY;
if (!key) { console.error('TIINGO_KEY missing'); process.exit(1); }
const out = { ts: new Date().toISOString(), tickers: {}, split: null, limits: null };
const get = async (t, start, end) => {
  const r = await fetch(`https://api.tiingo.com/tiingo/daily/${t}/prices?startDate=${start}${end ? '&endDate=' + end : ''}&token=${key}`, { headers: { 'content-type': 'application/json' } });
  const lim = {}; for (const [k, v] of r.headers) if (/limit|remaining|reset|retry/i.test(k)) lim[k] = v;
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, lim, rows: Array.isArray(j) ? j : null, txt: Array.isArray(j) ? '' : txt.slice(0, 200) };
};
for (const t of ['SPY', 'QQQ', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC', 'SMH', 'IGV', 'ITA', 'AAPL']) {
  const g = await get(t, '2024-09-01');
  const rows = g.rows ?? [];
  out.tickers[t] = { status: g.status, n: rows.length, first: rows[0]?.date?.slice(0, 10), last: rows[rows.length - 1]?.date?.slice(0, 10), lastRow: rows[rows.length - 1], divDays: rows.filter((r) => r.divCash).length, splitDays: rows.filter((r) => r.splitFactor !== 1).length, err: g.txt || undefined };
  out.limits = g.lim;
}
// A known split: NVDA 10-for-1, effective 10 Jun 2024. Raw close should fall ~10x that day; splitFactor 10 on the ex-date.
const n = await get('NVDA', '2024-06-05', '2024-06-12');
out.split = { status: n.status, rows: (n.rows ?? []).map((r) => ({ date: r.date.slice(0, 10), close: r.close, adjClose: r.adjClose, volume: r.volume, splitFactor: r.splitFactor, divCash: r.divCash })) };
writeFileSync('data/source-test/tiingo-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ t: Object.fromEntries(Object.entries(out.tickers).map(([k, v]) => [k, [v.status, v.n, v.first, v.last, v.divDays, v.splitDays]])), lim: out.limits, split: out.split.rows }));
