// Monthly business facts for listed stocks (scope K3): valuation, results growth and holding by quarter from Groww's public stock page, promoter pledge from NSE's quarterly shareholding filing.
// Covers the most traded stocks in the context file (STOCKFACTS_N, default 1200). Writes data/stocks/facts.json and facts-log.json. Public data only; nothing here says who holds what.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseStockPage, parsePledge } from '../src/pm/stockfacts.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'accept-language': 'en-IN,en;q=0.9' };
const N = +(process.env.STOCKFACTS_N ?? 1200), today = new Date().toISOString().slice(0, 10);
const get = async (url, h = {}, tries = 2) => { for (let i = 0; i < tries; i++) { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(40000) }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} await new Promise((r) => setTimeout(r, 1500)); } return null; };
const ctx = JSON.parse(readFileSync('site/pm-data/context.json', 'utf8')).stocks;
const syms = Object.entries(ctx).filter(([, v]) => v.advCr != null && v.series === 'EQ').sort((a, b) => b[1].advCr - a[1].advCr).slice(0, N).map(([s]) => s);
const isin = new Map(); { const t = await get('https://archives.nseindia.com/content/equities/EQUITY_L.csv'); for (const l of (t ?? '').split('\n').slice(1)) { const c = l.split(','); if (c.length > 6 && c[6]) isin.set(c[0].trim(), c[6].trim()); } }
const prev = existsSync('data/stocks/facts.json') ? JSON.parse(readFileSync('data/stocks/facts.json', 'utf8')) : { stocks: {} };
const out = { asOf: today, source: 'Groww stock pages and NSE shareholding filings (public)', stocks: {} };
const LOG = { start: new Date().toISOString(), wanted: syms.length, isinMissing: 0, noGroww: [], noFacts: [], noPledge: [], ok: 0, kept: 0 };
const nseH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
async function one(sym) {
  const id = isin.get(sym); if (!id) { LOG.isinMissing++; if (prev.stocks[sym]) { out.stocks[sym] = prev.stocks[sym]; LOG.kept++; } return; }
  let facts = null, pledge = null;
  const s = await get(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${encodeURIComponent(sym)}&size=8`, { accept: 'application/json' });
  let hit = null; try { hit = JSON.parse(s ?? '{}').content?.find((x) => x.isin === id || (x.nse_scrip_code === sym && /stock/i.test(String(x.entity_type ?? '')))); } catch {}
  if (!hit) LOG.noGroww.push(sym); else { const html = await get(`https://groww.in/stocks/${hit.search_id}`); facts = html ? parseStockPage(html, today) : null; if (!facts) LOG.noFacts.push(sym); }
  const m = await get(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(sym)}`, nseH);
  try { const rec = JSON.parse(m ?? '[]')[0]; if (rec?.xbrl) { const x = await get(rec.xbrl, { referer: 'https://www.nseindia.com/' }); pledge = x ? parsePledge(x, rec.date ?? null) : null; } } catch {}
  if (!pledge) LOG.noPledge.push(sym);
  if (!facts && !pledge) { if (prev.stocks[sym]) { out.stocks[sym] = prev.stocks[sym]; LOG.kept++; } return; }
  out.stocks[sym] = { ...(facts ?? (prev.stocks[sym] ? { ...prev.stocks[sym], pledge: undefined } : { asOf: today })), ...(pledge ? { pledge } : {}) }; LOG.ok++;
}
let i = 0; const worker = async () => { while (i < syms.length) { const sym = syms[i++]; try { await one(sym); } catch (e) { LOG.noFacts.push(sym + ':' + String(e).slice(0, 40)); } await new Promise((r) => setTimeout(r, 250)); if (i % 100 === 0) console.log(i, 'of', syms.length, 'ok', LOG.ok); } };
await Promise.all([worker(), worker(), worker()]);
if (LOG.ok < syms.length * 0.5) { console.error(`only ${LOG.ok} of ${syms.length} read: keeping the previous facts`); LOG.end = new Date().toISOString(); mkdirSync('data/stocks', { recursive: true }); writeFileSync('data/stocks/facts-log.json', JSON.stringify({ ...LOG, noGroww: LOG.noGroww.slice(0, 40), noFacts: LOG.noFacts.slice(0, 40), noPledge: LOG.noPledge.slice(0, 40) }, null, 1) + '\n'); process.exit(1); }
mkdirSync('data/stocks', { recursive: true });
writeFileSync('data/stocks/facts.json', JSON.stringify(out) + '\n');
LOG.end = new Date().toISOString(); writeFileSync('data/stocks/facts-log.json', JSON.stringify({ ...LOG, noGroww: LOG.noGroww.slice(0, 40), noFacts: LOG.noFacts.slice(0, 40), noPledge: LOG.noPledge.slice(0, 40), noGrowwN: LOG.noGroww.length, noFactsN: LOG.noFacts.length, noPledgeN: LOG.noPledge.length }, null, 1) + '\n');
console.log(JSON.stringify({ ok: LOG.ok, noGroww: LOG.noGroww.length, noFacts: LOG.noFacts.length, noPledge: LOG.noPledge.length }));
