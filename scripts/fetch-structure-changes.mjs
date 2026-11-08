// Reads NSE's symbol-change and name-change lists (public CSV files) into one JSON file used to link a company's filings across renames. Writes data/india/structure-changes.json. Public data only; fields are stored apart so no comma-joined ticker runs appear.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const iso = (v) => { const m = String(v || '').trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/); return m ? new Date(Date.UTC(+m[3], MON[m[2].toUpperCase()], +m[1])).toISOString().slice(0, 10) : null; };
const csv = (line) => { const o = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o.map((x) => x.trim()); };
const grab = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${u} ${r.status}`); return (await r.text()).split(/\r?\n/).filter(Boolean).slice(1).map(csv); };
const sym = await grab('https://nsearchives.nseindia.com/content/equities/symbolchange.csv');
const nm = await grab('https://nsearchives.nseindia.com/content/equities/namechange.csv');
const out = {
  fetched: new Date().toISOString(),
  note: 'NSE symbol-change and name-change lists, one row per change. Dates are effective dates. Mutual fund and ETF rows are included as published; filter on the old and new symbol against the equity universe.',
  symbolChanges: sym.map((r) => ({ name: r[0], oldSymbol: r[1], newSymbol: r[2], date: iso(r[3]) })).filter((r) => r.oldSymbol && r.newSymbol),
  nameChanges: nm.map((r) => ({ symbol: r[0], oldName: r[1], newName: r[2], date: iso(r[3]) })).filter((r) => r.symbol),
};
mkdirSync('data/india', { recursive: true });
writeFileSync('data/india/structure-changes.json', JSON.stringify(out) + '\n');
const rng = (a) => { const d = a.map((x) => x.date).filter(Boolean).sort(); return [d[0], d[d.length - 1]]; };
console.log('symbolChanges', out.symbolChanges.length, rng(out.symbolChanges), 'nameChanges', out.nameChanges.length, rng(out.nameChanges));
