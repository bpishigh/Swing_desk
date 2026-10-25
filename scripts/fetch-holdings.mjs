// Monthly fund portfolios (Engine Rules C-78): for each Direct mutual fund in data/funds/scores.json, read its equity holdings from the fund's public page.
// Writes data/funds/holdings.json keyed by scheme base name (a Regular plan shares its Direct plan's portfolio). Public data only; the funds held by anyone are never named here.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parsePage, parseEtfPage, parseQuality, qualityFlags } from '../src/pm/holdingsparse.ts';
import { schemeBase } from '../src/pm/lookthrough.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const LOG = { start: new Date().toISOString(), tried: 0, ok: 0, noMatch: [], noHoldings: [], failed: [] };
const all = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'mf' || f.g === 'idx'), isEtf = (f) => /\bETF\b|\bBeES\b/i.test(f.name), scores = all;
// ETF pages list companies by ISIN only: names and symbols come from the NSE corporate-actions history (ISIN with symbol) and data/names.json
const isinSym = new Map(); for (const r of JSON.parse(readFileSync('data/india/corp-actions-history.json', 'utf8'))) if (r.isin && r.symbol) isinSym.set(r.isin, r.symbol);
const names = JSON.parse(readFileSync('data/names.json', 'utf8')).india ?? {};
// the NSE list of listed companies carries symbol, name and ISIN for every one: it fills the ISINs the corporate-actions history lacks
try { const r = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.ok) { let n = 0; for (const line of (await r.text()).split(/\r?\n/).slice(1)) { const c = line.split(','); const sym = c[0]?.trim(), isin = c[6]?.trim(); if (sym && /^INE[0-9A-Z]{9}$/.test(isin ?? '')) { isinSym.set(isin, sym); n++; if (c[1] && !names[sym]) names[sym] = c[1].trim(); } } LOG.equityList = n; } else LOG.equityList = 'status ' + r.status; } catch (e) { LOG.equityList = 'failed ' + String(e.message || e).slice(0, 80); } LOG.etf = { tried: 0, ok: 0, linesIsin: 0, linesNamed: 0 };
const prev = existsSync('data/funds/holdings.json') ? JSON.parse(readFileSync('data/funds/holdings.json', 'utf8')) : { funds: {} };
const prevQ = existsSync('data/funds/quality.json') ? JSON.parse(readFileSync('data/funds/quality.json', 'utf8')) : { funds: {} }; const outQ = {};
const out = { asOf: new Date().toISOString().slice(0, 10), source: 'fund pages (public portfolio disclosures)', funds: {} };
const J = async (url) => { for (let a = 0; a < 3; a++) { try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000) }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} await new Promise((r) => setTimeout(r, 1500 * (a + 1))); } throw new Error('failed ' + url); };
// two different schemes can share one base name (a code change, a renamed twin): neither is stored, because a holder of the other would get the wrong portfolio
const baseCount = new Map(); for (const f of scores) baseCount.set(schemeBase(f.name), (baseCount.get(schemeBase(f.name)) ?? 0) + 1);
const collide = new Set([...baseCount].filter(([, n]) => n > 1).map(([b]) => b)); LOG.collisions = [...collide];
async function etf(f, base, old) {
  LOG.etf.tried++;
  try {
    const q = encodeURIComponent(f.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim());
    const s = await J(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`); const hit = s ? JSON.parse(s).content?.find((x) => x.isin && x.isin === f.isin) : null;
    if (!hit) { LOG.noMatch.push(f.code); if (old && old.code === f.code) out.funds[base] = old; return; }
    const html = await J(`https://groww.in/etfs/${hit.search_id}`); const p = html ? parseEtfPage(html) : null;
    if (!p || !p.lines.length) { LOG.noHoldings.push(f.code); if (old && old.code === f.code) out.funds[base] = old; return; }
    const lines = p.lines.map((l) => { const sym = isinSym.get(l.isin); sym ? LOG.etf.linesNamed++ : LOG.etf.linesIsin++; return { name: sym ? (names[sym] ?? sym) : l.isin, ...(sym ? { symbol: sym } : {}), isin: l.isin, weight: l.weight }; });
    out.funds[base] = { code: f.code, isin: f.isin, asOf: new Date().toISOString().slice(0, 10), etf: true, lines }; LOG.ok++; LOG.etf.ok++;   // an ETF page carries no portfolio date: the fetch date stands in
  } catch (e) { LOG.failed.push(f.code); if (old) out.funds[base] = old; }
}
let next = 0;
async function one(f) {
  LOG.tried++; const base = schemeBase(f.name), old = prev.funds?.[base];
  if (collide.has(base)) return;
  if (isEtf(f)) return etf(f, base, old);
  try {
    const q = encodeURIComponent(f.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim());
    const s = await J(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`); const hit = s ? JSON.parse(s).content?.find((x) => String(x.scheme_code) === String(f.code) || (x.isin && x.isin === f.isin)) : null;
    if (!hit) { LOG.noMatch.push(f.code); if (old && old.code === f.code) out.funds[base] = old; return; }
    const html = await J(`https://groww.in/mutual-funds/${hit.search_id}`); const p = html ? parsePage(html) : null;
    { const q = html ? parseQuality(html) : null; if (q && q.managers.length) { const o = prevQ.funds?.[base]; outQ[base] = { code: f.code, isin: f.isin, asOf: new Date().toISOString().slice(0, 10), ...q, flags: qualityFlags(q, o && o.code === f.code ? o : null, new Date().toISOString().slice(0, 10)) }; } else if (prevQ.funds?.[base]?.code === f.code) outQ[base] = prevQ.funds[base]; }
    if (!p || !p.lines.length || !p.asOf) { LOG.noHoldings.push(f.code); if (old && old.code === f.code) out.funds[base] = old; return; }
    if (p.code && String(p.code) !== String(f.code)) { LOG.noMatch.push(f.code + '!' + p.code); return; }   // the page is another scheme: never store it under this one
    out.funds[schemeBase(f.name)] = { code: f.code, isin: f.isin, asOf: p.asOf, lines: p.lines.map((l) => ({ name: l.name, weight: l.weight })) }; LOG.ok++;
  } catch (e) { LOG.failed.push(f.code); const o = prev.funds?.[schemeBase(f.name)]; if (o) out.funds[schemeBase(f.name)] = o; }   // keep last month's portfolio if this month's fetch fails
}
await Promise.all(Array.from({ length: 5 }, async () => { while (next < scores.length) { const f = scores[next++]; await one(f); await new Promise((r) => setTimeout(r, 250)); } }));
LOG.funds = Object.keys(out.funds).length; LOG.end = new Date().toISOString(); const before = Object.keys(prev.funds ?? {}).length; LOG.before = before; LOG.ok_ = LOG.ok >= scores.length * 0.5 && (!before || Object.keys(out.funds).length >= before * 0.9);   // a drop of more than 10% against last month keeps last month's file
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/holdings-log.json', JSON.stringify({ ...LOG, noMatchCount: LOG.noMatch.length, noHoldingsCount: LOG.noHoldings.length, failedCount: LOG.failed.length, noMatch: LOG.noMatch.slice(0, 200), noHoldings: LOG.noHoldings.slice(0, 200), failed: LOG.failed.slice(0, 200) }, null, 1) + '\n');
console.log(`tried ${LOG.tried} ok ${LOG.ok} noMatch ${LOG.noMatch.length} noHoldings ${LOG.noHoldings.length} failed ${LOG.failed.length}`);
if (!LOG.ok_) { console.error('too few portfolios; keeping the previous file'); process.exit(1); }
const sorted = Object.fromEntries(Object.entries(out.funds).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('data/funds/holdings.json', JSON.stringify({ ...out, funds: sorted }) + '\n');
// fund quality facts (C-108): same pages, public data only; kept from last month where this month's read failed
{ const sortedQ = Object.fromEntries(Object.entries(outQ).sort(([a], [b]) => a.localeCompare(b))); const today = new Date().toISOString().slice(0, 10);
  writeFileSync('data/funds/quality.json', JSON.stringify({ asOf: today, source: 'fund pages (public)', funds: sortedQ }) + '\n');
  const lp = 'data/funds/quality-log.json', log = existsSync(lp) ? JSON.parse(readFileSync(lp, 'utf8')) : { months: {} }; log.months[today.slice(0, 7)] = Object.fromEntries(Object.entries(sortedQ).map(([k, v]) => [k, { m: v.managers.map((x) => x.name + (x.since ? '@' + x.since : '')), aum: v.aum, bm: v.benchmark, er: v.expense, to: v.turnover }]));
  writeFileSync(lp, JSON.stringify(log) + '\n'); console.log('quality records ' + Object.keys(sortedQ).length); }
