// Historical results (board meeting) dates for the Nifty 500, from NSE's board-meetings feed, for the earnings run-up test (C-59). Writes data/india/results-dates.json.
// Usage: node scripts/fetch-results-dates.mjs [--limit N]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', referer: 'https://www.nseindia.com/' };
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const iso = (s) => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s ?? '')); return m && MON[m[2]] ? `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, '0')}` : null; };
const syms = JSON.parse(readFileSync('data/india/nifty500.json', 'utf8')).symbols;
const lim = process.argv.indexOf('--limit'); const list = lim > 0 ? syms.slice(0, Number(process.argv[lim + 1])) : syms;
const prev = existsSync('data/india/results-dates.json') ? JSON.parse(readFileSync('data/india/results-dates.json', 'utf8')) : { dates: {} };
let cookie = ''; try { const r = await fetch('https://www.nseindia.com/', { headers: UA }); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; '); } catch {}
const out = {}, stat = { ok: 0, empty: 0, failed: 0, events: 0, earliest: '9999' };
let next = 0;
async function one(s) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://www.nseindia.com/api/corporate-board-meetings?index=equities&symbol=${encodeURIComponent(s)}`, { headers: { ...UA, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('status ' + r.status);
      const rows = await r.json(); if (!Array.isArray(rows)) throw new Error('not a list');
      const d = new Set(); for (const x of rows) { if (!/financial results|unaudited|audited/i.test(`${x.bm_purpose ?? ''} ${x.bm_desc ?? ''}`)) continue; const t = iso(x.bm_date); if (t) d.add(t); }
      out[s] = [...d].sort(); stat.events += d.size; if (d.size) { stat.ok++; stat.earliest = out[s][0] < stat.earliest ? out[s][0] : stat.earliest; } else stat.empty++; return;
    } catch { await new Promise((z) => setTimeout(z, 1200 * (a + 1))); }
  }
  stat.failed++; if (prev.dates[s]) out[s] = prev.dates[s];
}
await Promise.all(Array.from({ length: 3 }, async () => { while (next < list.length) { await one(list[next++]); await new Promise((z) => setTimeout(z, 250)); } }));
console.log(JSON.stringify(stat));
if (stat.ok < list.length * 0.5) { console.error('too few symbols read; keeping the previous file'); process.exit(1); }
writeFileSync('data/india/results-dates.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'NSE corporate-board-meetings (financial results meetings)', stat, dates: out }) + '\n');
