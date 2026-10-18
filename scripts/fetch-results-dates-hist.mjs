// Older results (board meeting) dates, Oct 2019 to Dec 2023, for the earnings run-up test (C-59). All companies per month from NSE's board-meetings feed
// (a date range reaches back further than the plain per-symbol call, which only holds about two years). Merged into data/india/results-dates.json.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', referer: 'https://www.nseindia.com/' };
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const iso = (s) => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s ?? '')); return m && MON[m[2]] ? `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, '0')}` : null; };
const file = 'data/india/results-dates.json', cur = JSON.parse(readFileSync(file, 'utf8'));
const want = new Set(JSON.parse(readFileSync('data/india/nifty500.json', 'utf8')).symbols);
let cookie = ''; try { const r = await fetch('https://www.nseindia.com/', { headers: UA }); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; '); } catch {}
const pad = (n) => String(n).padStart(2, '0'), last = (y, m) => new Date(y, m, 0).getDate();
const added = {}, perMonth = {}; let bad = 0;
for (let y = 2019; y <= 2023; y++) for (let m = 1; m <= 12; m++) {
  if (y === 2019 && m < 10) continue;
  const q = `from_date=01-${pad(m)}-${y}&to_date=${last(y, m)}-${pad(m)}-${y}`; let rows = null;
  for (let a = 0; a < 4 && !rows; a++) { try { const r = await fetch(`https://www.nseindia.com/api/corporate-board-meetings?index=equities&${q}`, { headers: { ...UA, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(r.status); const j = await r.json(); if (Array.isArray(j)) rows = j; } catch { await new Promise((z) => setTimeout(z, 1500 * (a + 1))); } }
  if (!rows) { bad++; perMonth[`${y}-${pad(m)}`] = 'failed'; continue; }
  let n = 0; for (const x of rows) { if (!want.has(x.bm_symbol) || !/results/i.test(`${x.bm_purpose ?? ''} ${x.bm_desc ?? ''}`)) continue; const t = iso(x.bm_date); if (t) { (added[x.bm_symbol] ||= new Set()).add(t); n++; } }
  perMonth[`${y}-${pad(m)}`] = `${rows.length}/${n}`; await new Promise((z) => setTimeout(z, 600));
}
let ev = 0, earliest = '9999'; for (const s of want) { const set = new Set([...(cur.dates[s] || []), ...(added[s] || [])]); if (set.size) cur.dates[s] = [...set].sort(); for (const d of cur.dates[s] || []) { ev++; if (d < earliest) earliest = d; } }
console.log(JSON.stringify(perMonth)); console.log({ bad, ev, earliest });
if (bad > 6) { console.error('too many failed months; not writing'); process.exit(1); }
cur.stat = { ...cur.stat, events: ev, earliest, histMonths: perMonth }; cur.source += ' + date-range pull 2019-10..2023-12';
writeFileSync(file, JSON.stringify(cur) + '\n');
