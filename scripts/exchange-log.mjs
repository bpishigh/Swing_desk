// Wave 2 collection (Batch C, C-5): store the day's NSE surveillance lists and bulk and block deals. These cannot be recovered later, so the job is idempotent and safe to run twice a day (evening, then the next morning as the retry).
// Writes data/india/surveillance/<date>.json, data/india/deals/<deal date>.json and data/india/exchange-log-status.json. Exits 1 if a source failed after retries, so the run shows as failed. Public data only; changes no rule.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { parseDeals, parseSurveillance } from '../src/ingest/exchange-log.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.nseindia.com/', accept: 'application/json,text/csv,*/*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.status === 200) return await r.text(); } catch {} await sleep(2000 * (i + 1)); } return null; };
const R = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const istDate = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
await get('https://www.nseindia.com/'); await sleep(800);
const status = R('data/india/exchange-log-status.json', {}); const fails = [];
const j = async (u) => { const t = await get(u); try { return t ? JSON.parse(t) : null; } catch { return null; } };
// 1. Surveillance (one file per run date; a second run the same day overwrites with the later list)
const [asm, gsm, esm] = [await j('https://www.nseindia.com/api/reportASM'), await j('https://www.nseindia.com/api/reportGSM'), await j('https://www.nseindia.com/api/reportESM')];
if (asm && gsm && esm) {
  const s = parseSurveillance(asm, gsm, esm); mkdirSync('data/india/surveillance', { recursive: true });
  writeFileSync(`data/india/surveillance/${istDate}.json`, JSON.stringify({ fetched: new Date().toISOString(), source: 'nseindia.com/api/reportASM, reportGSM, reportESM', ...s }) + '\n');
  status.surveillance = { last: istDate, counts: { asmLong: s.asmLong.length, asmShort: s.asmShort.length, gsm: s.gsm.length, esm: s.esm.length } };
} else fails.push('surveillance');
// 2. Bulk and block deals: the exchange file holds the latest session only, so the date comes from the rows
mkdirSync('data/india/deals', { recursive: true });
const bulk = await get('https://nsearchives.nseindia.com/content/equities/bulk.csv'), block = await get('https://nsearchives.nseindia.com/content/equities/block.csv');
if (bulk != null && block != null) {
  const b = parseDeals(bulk), k = parseDeals(block), dates = [...new Set([...b.rows, ...k.rows].map((r) => r.date))].sort();
  for (const d of dates) writeFileSync(`data/india/deals/${d}.json`, JSON.stringify({ date: d, fetched: new Date().toISOString(), source: 'nsearchives.nseindia.com bulk.csv, block.csv', bulk: b.rows.filter((r) => r.date === d), block: k.rows.filter((r) => r.date === d) }) + '\n');
  status.deals = { last: dates.at(-1) ?? null, days: dates.length, bulkRows: b.rows.length, blockRows: k.rows.length, badRows: b.bad + k.bad };
} else fails.push('deals');
status.run = { at: new Date().toISOString(), failed: fails };
writeFileSync('data/india/exchange-log-status.json', JSON.stringify(status) + '\n');
console.log(JSON.stringify(status));
if (fails.length) { console.error('FAILED: ' + fails.join(', ')); process.exit(1); }
