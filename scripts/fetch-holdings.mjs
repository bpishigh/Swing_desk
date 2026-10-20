// Monthly fund portfolios (Engine Rules C-78): for each Direct mutual fund in data/funds/scores.json, read its equity holdings from the fund's public page.
// Writes data/funds/holdings.json keyed by scheme base name (a Regular plan shares its Direct plan's portfolio). Public data only; the funds held by anyone are never named here.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parsePage } from '../src/pm/holdingsparse.ts';
import { schemeBase } from '../src/pm/lookthrough.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const LOG = { start: new Date().toISOString(), tried: 0, ok: 0, noMatch: [], noHoldings: [], failed: [] };
const scores = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'mf' || f.g === 'idx');
const prev = existsSync('data/funds/holdings.json') ? JSON.parse(readFileSync('data/funds/holdings.json', 'utf8')) : { funds: {} };
const out = { asOf: new Date().toISOString().slice(0, 10), source: 'fund pages (public portfolio disclosures)', funds: {} };
const J = async (url) => { for (let a = 0; a < 3; a++) { try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000) }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} await new Promise((r) => setTimeout(r, 1500 * (a + 1))); } throw new Error('failed ' + url); };
let next = 0;
async function one(f) {
  LOG.tried++;
  try {
    const q = encodeURIComponent(f.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim());
    const s = await J(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`); const hit = s ? JSON.parse(s).content?.find((x) => String(x.scheme_code) === String(f.code) || (x.isin && x.isin === f.isin)) : null;
    if (!hit) { LOG.noMatch.push(f.code); return; }
    const html = await J(`https://groww.in/mutual-funds/${hit.search_id}`); const p = html ? parsePage(html) : null;
    if (!p || !p.lines.length || !p.asOf) { LOG.noHoldings.push(f.code); return; }
    if (p.code && String(p.code) !== String(f.code)) { LOG.noMatch.push(f.code + '!' + p.code); return; }   // the page is another scheme: never store it under this one
    out.funds[schemeBase(f.name)] = { code: f.code, isin: f.isin, asOf: p.asOf, lines: p.lines.map((l) => ({ name: l.name, weight: l.weight })) }; LOG.ok++;
  } catch (e) { LOG.failed.push(f.code); const o = prev.funds?.[schemeBase(f.name)]; if (o) out.funds[schemeBase(f.name)] = o; }   // keep last month's portfolio if this month's fetch fails
}
await Promise.all(Array.from({ length: 5 }, async () => { while (next < scores.length) { const f = scores[next++]; await one(f); await new Promise((r) => setTimeout(r, 250)); } }));
LOG.funds = Object.keys(out.funds).length; LOG.end = new Date().toISOString(); LOG.ok_ = LOG.ok >= scores.length * 0.5;
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/holdings-log.json', JSON.stringify({ ...LOG, noMatch: LOG.noMatch.slice(0, 40), noHoldings: LOG.noHoldings.slice(0, 40), failed: LOG.failed.slice(0, 40) }, null, 1) + '\n');
console.log(`tried ${LOG.tried} ok ${LOG.ok} noMatch ${LOG.noMatch.length} noHoldings ${LOG.noHoldings.length} failed ${LOG.failed.length}`);
if (!LOG.ok_) { console.error('too few portfolios; keeping the previous file'); process.exit(1); }
const sorted = Object.fromEntries(Object.entries(out.funds).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('data/funds/holdings.json', JSON.stringify({ ...out, funds: sorted }) + '\n');
