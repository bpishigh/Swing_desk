// Nightly Form 4 loader for the US insider-buying paper book (src/engine/insider.ts). Forward only: for each top-500 name, SEC submissions lists new Form 4 filings (form '4' only, not '4/A');
// each new one is read and kept when it holds an open-market purchase (code P, non-derivative, acquired) by an officer or director worth at least $250,000 for one insider.
// Appends to data/us/insider/events.json (deduplicated by accession number). Needs sec.gov (the runner). First run looks back 5 days. Output feeds the book only through signalDate.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d), OUT = 'data/us/insider/events.json', FLOOR = 250000;
const store = R(OUT, { updated: null, seen: [], events: [] }), seen = new Set(store.seen);
const syms = Object.keys(R('data/us/fundamentals/latest.json').rows);
const since = store.updated ? new Date(Date.parse(store.updated) - 3 * 864e5).toISOString().slice(0, 10) : new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
const getJson = async (u) => { for (let a = 0; a < 3; a++) { try { const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) return r; await sleep(1000); } catch { await sleep(1000); } } return null; };
const et = (iso) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).reduce((a, x) => ((a[x.type] = x.value), a), {}); return { date: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) }; };
const tag = (s, n) => { const m = s.match(new RegExp(`<${n}>\\s*(?:<value>)?\\s*([^<]*?)\\s*(?:</value>)?\\s*</${n}>`)); return m ? m[1] : null; };
const nextSession = (d) => { const x = new Date(Date.parse(d) + 864e5); while ([0, 6].includes(x.getUTCDay())) x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };   // holidays: a later session; the book only acts on session dates it has
let checked = 0, found = 0, newEvents = 0;
for (const s of syms) {
  const ff = `data/us/facts/${s.replace(/[^A-Za-z0-9.-]/g, '_')}.json.gz`; if (!existsSync(ff)) continue;
  const cik = String(JSON.parse(gunzipSync(readFileSync(ff))).cik).padStart(10, '0'), r = await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`); await sleep(120); if (!r) continue; checked++;
  const rc = (await r.json()).filings?.recent; if (!rc) continue;
  for (let i = 0; i < rc.form.length; i++) {
    if (rc.form[i] !== '4' || rc.filingDate[i] < since || seen.has(rc.accessionNumber[i])) continue;
    const accn = rc.accessionNumber[i], doc = String(rc.primaryDocument[i]).split('/').pop(), url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replace(/-/g, '')}/${doc}`;
    const x = await getJson(url); await sleep(120); if (!x) continue; seen.add(accn); const xml = await x.text();
    if (!/<nonDerivativeTransaction>/.test(xml)) continue;
    const owners = [...xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/g)].map((m) => m[1]).filter((o) => tag(o, 'isDirector') === '1' || tag(o, 'isDirector') === 'true' || tag(o, 'isOfficer') === '1' || tag(o, 'isOfficer') === 'true');
    if (!owners.length) continue;
    let value = 0, first = null;
    for (const m of xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)) { const b = m[1]; if (tag(b, 'transactionCode') !== 'P' || tag(b, 'transactionAcquiredDisposedCode') !== 'A') continue; const sh = Number(tag(b, 'transactionShares')), pr = Number(tag(b, 'transactionPricePerShare')); if (sh > 0 && pr > 0) { value += sh * pr; const d = tag(b, 'transactionDate'); if (d && (!first || d < first)) first = d; } }
    // a filing with several reporting owners is a joint filing of one purchase: counted once, not per owner
    if (value < FLOOR) continue; found++;
    const acc = et(rc.acceptanceDateTime[i]), signalDate = acc.min >= 960 ? nextSession(acc.date) : acc.date;
    const title = owners.map((o) => (tag(o, 'officerTitle') || '').toUpperCase()).join(' ');
    store.events.push({ sym: s, accn, signalDate, filed: rc.filingDate[i], accepted: rc.acceptanceDateTime[i], value: Math.round(value), ceoCfo: /CEO|CHIEF EXECUTIVE|CFO|CHIEF FINANCIAL/.test(title), lagDays: first ? Math.round((Date.parse(rc.filingDate[i]) - Date.parse(first)) / 864e5) : null }); newEvents++;
  }
}
for (const e of store.events) e.distinct30 = new Set(store.events.filter((o) => o.sym === e.sym && Date.parse(o.filed) <= Date.parse(e.filed) && Date.parse(e.filed) - Date.parse(o.filed) <= 30 * 864e5).map((o) => o.accn)).size;   // filings by this issuer in the last 30 days (a stand-in for distinct insiders)
store.updated = new Date().toISOString().slice(0, 10); store.seen = [...seen].slice(-20000); store.events = store.events.slice(-5000);
mkdirSync('data/us/insider', { recursive: true }); writeFileSync(OUT, JSON.stringify(store) + '\n');
console.log(JSON.stringify({ checkedNames: checked, qualifyingFilings: found, newEvents, stored: store.events.length, since }));
