// A1 US: how long before the 10-Q or 10-K was the earnings release (8-K, item 2.02) filed? The figures table dates a result by its 10-Q/10-K filing; the market usually knew from the 8-K, so the drift a book can capture
// starts earlier than the table says. For every name whose latest filing is recent and whose SUE is at least 2.0, this finds the latest 8-K with item 2.02 filed up to 75 days before that filing and logs the gap in days.
// Output data/us/eightk-gap.json { updated, rows: { "TICKER|filingDay": { eightK, tenQ, days } } }. Needs sec.gov (the runner). Descriptive only: no rule reads it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const get = async (u) => { for (let a = 0; a < 3; a++) { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.json(); if (r.status === 429 || r.status >= 500) { await sleep(3000 * (a + 1)); continue; } return null; } catch { await sleep(2000 * (a + 1)); } } return null; };
const fund = R('data/us/fundamentals/latest.json'); if (!fund) { console.log('no figures table'); process.exit(0); }
const OUT = 'data/us/eightk-gap.json', cur = R(OUT, { rows: {} }), day = (s) => s.slice(0, 10), DAY = 864e5;
const recent = Date.parse(fund.asOf) - 7 * DAY; let added = 0, miss = 0;
for (const [sym, f] of Object.entries(fund.rows)) {
  if (!f.asOf || !(f.sue?.value >= 2) || Date.parse(day(f.asOf)) < recent) continue;
  const key = `${sym}|${day(f.asOf)}`; if (cur.rows[key]) continue;
  const fp = `data/us/facts/${sym.replace(/[^A-Za-z0-9.-]/g, '_')}.json.gz`; if (!existsSync(fp)) continue;
  const cik = JSON.parse(gunzipSync(readFileSync(fp)).toString('utf8')).cik; if (!cik) continue;
  const sub = await get(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`); await sleep(150); if (!sub) { miss++; continue; }
  const rc = sub.filings?.recent, tenQ = day(f.asOf); let best = null;
  for (let i = 0; i < (rc?.form?.length ?? 0); i++) { if (rc.form[i] !== '8-K' || !(rc.items?.[i] ?? '').split(',').includes('2.02')) continue; const d = rc.filingDate[i]; if (d <= tenQ && Date.parse(tenQ) - Date.parse(d) <= 75 * DAY && (!best || d > best)) best = d; }
  cur.rows[key] = { eightK: best, tenQ, days: best ? Math.round((Date.parse(tenQ) - Date.parse(best)) / DAY) : null }; added++;
}
cur.updated = fund.asOf; writeFileSync(OUT, JSON.stringify(cur) + '\n'); console.log('gap rows added', added, 'unreachable', miss, 'total', Object.keys(cur.rows).length);
