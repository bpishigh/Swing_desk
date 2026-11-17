// Nightly 8-K Item 2.02 loader for the US run-up paper book (src/engine/runup.ts). Forward only: new earnings-release filings of the top-500 names since the last run (first run: 5 days).
// Appends to data/us/eightk-live.json {updated, seen, events:[{sym, filed, accepted, etDate, etMin}]}; the history used for "first release of the quarter" is data/us/eightk-202.json (count run, 17 Nov 2026).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d), OUT = 'data/us/eightk-live.json';
const store = R(OUT, { updated: null, seen: [], events: [] }), seen = new Set(store.seen);
const syms = Object.keys(R('data/us/fundamentals/latest.json').rows);
const since = store.updated ? new Date(Date.parse(store.updated) - 3 * 864e5).toISOString().slice(0, 10) : new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
const et = (iso) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).reduce((a, x) => ((a[x.type] = x.value), a), {}); return { date: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) }; };
let checked = 0, added = 0;
for (const s of syms) {
  const ff = `data/us/facts/${s.replace(/[^A-Za-z0-9.-]/g, '_')}.json.gz`; if (!existsSync(ff)) continue;
  const cik = String(JSON.parse(gunzipSync(readFileSync(ff))).cik).padStart(10, '0'); let j = null;
  for (let a = 0; a < 3 && !j; a++) { try { const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) j = await r.json(); else await sleep(1000); } catch { await sleep(1000); } }
  await sleep(120); if (!j) continue; checked++; const rc = j.filings?.recent; if (!rc) continue;
  for (let i = 0; i < rc.form.length; i++) {
    if (rc.form[i] !== '8-K' || rc.filingDate[i] < since || !(rc.items[i] || '').split(',').includes('2.02') || seen.has(rc.accessionNumber[i])) continue;
    const t = et(rc.acceptanceDateTime[i]); seen.add(rc.accessionNumber[i]);
    store.events.push({ sym: s, filed: rc.filingDate[i], accepted: rc.acceptanceDateTime[i], etDate: t.date, etMin: t.min }); added++;
  }
}
store.updated = new Date().toISOString().slice(0, 10); store.seen = [...seen].slice(-5000); store.events = store.events.slice(-4000);
mkdirSync('data/us', { recursive: true }); writeFileSync(OUT, JSON.stringify(store) + '\n'); console.log(JSON.stringify({ checkedNames: checked, added, stored: store.events.length, since }));
