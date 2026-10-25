// Monthly: facts for the Direct international funds in data/funds/scores.json, read from sharpely.in fund pages (robots.txt allows). Writes data/funds/intlfacts.json (by ISIN) and intlfacts-log.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseIntlPage, intlKey } from '../src/pm/intlfacts.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'text/html,application/xml,*/*' };
const get = async (u) => { for (const manual = existsSync('data/funds/intlfacts-map.json') ? JSON.parse(readFileSync('data/funds/intlfacts-map.json', 'utf8')) : {};
let i = 0; i < 2; i++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} } return null; };
const funds = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'intl' && f.isin);
const sm = await get('https://sharpely.in/sitemap-mf.xml'); if (!sm) { console.error('sitemap unreachable: keeping the previous file'); process.exit(1); }
const pages = new Map(); for (const m of sm.matchAll(/<loc>(https:\/\/sharpely\.in\/mutual-funds\/([^/<]+)\/\d+)<\/loc>/g)) { const k = intlKey(m[2]); (pages.get(k) ?? pages.set(k, []).get(k)).push(m[1]); }
const prev = existsSync('data/funds/intlfacts.json') ? JSON.parse(readFileSync('data/funds/intlfacts.json', 'utf8')) : { funds: {} };
const out = { asOf: new Date().toISOString().slice(0, 10), source: 'sharpely.in fund pages (public)', funds: {} }, LOG = { start: new Date().toISOString(), wanted: funds.length, ok: 0, kept: 0, noPage: [], ambiguous: [], noFacts: [] };
let i = 0;
const one = async (f) => {
  const c = manual[f.isin] ? [manual[f.isin]] : pages.get(intlKey(f.name));
  if (!c) { LOG.noPage.push(f.name); return; } if (c.length > 1) { LOG.ambiguous.push(f.name); return; }
  const html = await get(c[0]), s = html ? parseIntlPage(html) : null;
  if (!s) { LOG.noFacts.push(f.name); if (prev.funds?.[f.isin]) { out.funds[f.isin] = prev.funds[f.isin]; LOG.kept++; } return; }
  out.funds[f.isin] = { ...s, readOn: out.asOf }; LOG.ok++;
};
await Promise.all(Array.from({ length: 3 }, async () => { while (i < funds.length) { await one(funds[i++]).catch(() => {}); await new Promise((r) => setTimeout(r, 400)); } }));
LOG.end = new Date().toISOString();
writeFileSync('data/funds/intlfacts-log.json', JSON.stringify(LOG, null, 1) + '\n');
if (LOG.ok < funds.length * 0.3) { console.error(`only ${LOG.ok} of ${funds.length} read: keeping the previous file`); process.exit(1); }
writeFileSync('data/funds/intlfacts.json', JSON.stringify(out) + '\n');
console.log(JSON.stringify({ ok: LOG.ok, noPage: LOG.noPage.length, ambiguous: LOG.ambiguous.length, noFacts: LOG.noFacts.length }));
