// Company names for the dashboard's hover text (17 Oct 2026). India: NSE's list of listed equities; US: Nasdaq's stock screener. Public data only.
// Writes data/names.json {asOf, india:{SYM:name}, us:{SYM:name}}. A failed fetch keeps the cached side. Usage: node scripts/fetch-names.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const prev = existsSync('data/names.json') ? JSON.parse(readFileSync('data/names.json', 'utf8')) : { india: {}, us: {} };
const out = { asOf: new Date().toISOString().slice(0, 10), india: prev.india || {}, us: prev.us || {} };
try {
  const r = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', { headers: UA }); if (!r.ok) throw new Error('status ' + r.status);
  const m = {}; for (const l of (await r.text()).trim().split('\n').slice(1)) { const c = l.split(','); if (c[0] && c[1]) m[c[0].trim()] = c[1].trim(); }
  if (Object.keys(m).length < 1500) throw new Error('only ' + Object.keys(m).length); out.india = m; console.log('india names', Object.keys(m).length);
} catch (e) { console.log('india names not refreshed:', e.message); }
try {
  const r = await fetch('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25000&download=true', { headers: { ...UA, accept: 'application/json' } }); if (!r.ok) throw new Error('status ' + r.status);
  const rows = (await r.json()).data?.rows ?? []; const m = {};
  for (const x of rows) if (x.symbol && x.name) m[x.symbol.trim()] = x.name.replace(/\s+(Common Stock|Class [A-Z] Common Stock|Ordinary Shares?|American Depositary Shares?.*|Common Shares?)\s*$/i, '').trim();
  if (Object.keys(m).length < 3000) throw new Error('only ' + Object.keys(m).length); out.us = m; console.log('us names', Object.keys(m).length);
} catch (e) { console.log('us names not refreshed:', e.message); }
writeFileSync('data/names.json', JSON.stringify(out) + '\n');
