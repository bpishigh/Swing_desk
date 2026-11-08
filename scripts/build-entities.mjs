// Builds data/india/entities.json (filings loader step 2) from the stored price files (first and last session of each symbol), NSE's symbol-change and name-change lists, and the corporate-action history.
// Usage: node scripts/build-entities.mjs   (reads data/india/bhav-pre2020, bhav-hist, bhav, structure-changes.json, corp-actions-history*.json)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildEntities } from '../src/ingest/entities.ts';
const root = 'data/india', spans = {}, EQ = new Set(['EQ', 'BE', 'BZ', 'SM', 'ST', 'BL', 'IL']);
const take = (d) => { for (const [s, r] of Object.entries(d.rows)) { if (!EQ.has(r[0])) continue; const x = spans[s]; if (!x) spans[s] = { first: d.date, last: d.date }; else { if (d.date < x.first) x.first = d.date; if (d.date > x.last) x.last = d.date; } } };
let asOf = '';
for (const dir of ['bhav-pre2020', 'bhav-hist']) for (const f of readdirSync(`${root}/${dir}`).filter((x) => x.endsWith('.json.gz')).sort()) { const d = JSON.parse(gunzipSync(readFileSync(`${root}/${dir}/${f}`))); take(d); asOf = d.date > asOf ? d.date : asOf; }
for (const f of readdirSync(`${root}/bhav`).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) { const d = JSON.parse(readFileSync(`${root}/bhav/${f}`, 'utf8')); take(d); asOf = d.date > asOf ? d.date : asOf; }
const sc = JSON.parse(readFileSync(`${root}/structure-changes.json`, 'utf8'));
const actions = [...(existsSync(`${root}/corp-actions-history-pre2019.json`) ? JSON.parse(readFileSync(`${root}/corp-actions-history-pre2019.json`, 'utf8')) : []), ...JSON.parse(readFileSync(`${root}/corp-actions-history.json`, 'utf8')), ...(existsSync(`${root}/corp-actions.json`) ? JSON.parse(readFileSync(`${root}/corp-actions.json`, 'utf8')) : [])];
const t = buildEntities({ spans, symbolChanges: sc.symbolChanges, nameChanges: sc.nameChanges, actions: actions.filter((a) => a && a.symbol && a.subject && a.exDate), asOf });
const out = { note: 'Entity table for the filings loader (docs/FILINGS_LOADER_SPEC.md, C-157). Built from price-file spans, NSE symbol-change and name-change lists and the corporate-action history. A ticker is an attribute; the id never changes. review lists links that did not fit cleanly and were not merged.', builtFrom: { symbolChanges: sc.fetched, lastSession: asOf }, ...t };
writeFileSync(`${root}/entities.json`, JSON.stringify(out) .replace(/\},\{"id"/g, '},\n{"id"') + '\n');
console.log(JSON.stringify(t.counts));
