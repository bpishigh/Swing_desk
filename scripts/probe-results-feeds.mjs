// One-off probe (18 Oct 2026): which NSE feeds hold results dates before 2024? Writes data/ops/probe-results.json.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', referer: 'https://www.nseindia.com/' };
let cookie = ''; try { const r = await fetch('https://www.nseindia.com/', { headers: UA }); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; '); } catch {}
const tests = {
  bm_all_2021: 'corporate-board-meetings?index=equities&from_date=01-01-2021&to_date=31-03-2021',
  bm_sym_range: 'corporate-board-meetings?index=equities&symbol=RELIANCE&from_date=01-01-2020&to_date=31-12-2023',
  bm_sym_plain: 'corporate-board-meetings?index=equities&symbol=RELIANCE',
  fr_q_2021: 'corporates-financial-results?index=equities&period=Quarterly&from_date=01-01-2021&to_date=31-03-2021',
  fr_sym: 'corporates-financial-results?index=equities&symbol=RELIANCE&period=Quarterly',
  fr_sym_range: 'corporates-financial-results?index=equities&symbol=RELIANCE&period=Quarterly&from_date=01-01-2020&to_date=31-12-2023',
  ann_sym: 'corporate-announcements?index=equities&symbol=RELIANCE&from_date=01-01-2020&to_date=31-12-2021',
  ev_2021: 'event-calendar?index=equities&from_date=01-01-2021&to_date=31-03-2021',
};
const out = {};
for (const [k, p] of Object.entries(tests)) {
  try {
    const r = await fetch('https://www.nseindia.com/api/' + p, { headers: { ...UA, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(45000) });
    const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch {}
    const rows = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : null;
    out[k] = { status: r.status, bytes: txt.length, rows: rows?.length ?? null, keys: rows?.[0] ? Object.keys(rows[0]) : j ? Object.keys(j).slice(0, 8) : txt.slice(0, 120), first: rows?.[0] ?? null, last: rows?.at(-1) ?? null };
  } catch (e) { out[k] = { error: String(e).slice(0, 150) }; }
  await new Promise((z) => setTimeout(z, 800));
}
mkdirSync('data/ops', { recursive: true }); writeFileSync('data/ops/probe-results.json', JSON.stringify(out, null, 1) + '\n'); console.log(Object.entries(out).map(([k, v]) => k + ' ' + (v.error ?? `${v.status} rows ${v.rows}`)).join('\n'));
