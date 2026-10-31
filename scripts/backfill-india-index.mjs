// India index history back-fill (backtester data, step 3): NSE's daily index close file for every stored session 2010 to 15 Oct 2025 (files exist from about mid-2012; old CNX names are mapped to the current ones).
// Keeps open/high/low/close/volume for the indices the desk uses, plus the broad ones and India VIX, in data/india/idx-hist/idx-YYYY.json
// as { "<index name>": { "YYYY-MM-DD": [open, high, low, close, volume] } }. Resumable: a date already present in the file is skipped.
// Usage: node scripts/backfill-india-index.mjs [--max=N]
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseIndexCloseCsv } from '../src/ingest/india-index.ts';
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=100000').slice(6));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: '*/*', referer: 'https://www.nseindia.com/' };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const KEEP = new Set(['Nifty 50', 'Nifty 100', 'Nifty 200', 'Nifty 500', 'Nifty Midcap 100', 'Nifty Smallcap 100', 'India VIX', 'Nifty Auto', 'Nifty Bank', 'Nifty Capital Markets', 'Nifty Chemicals', 'Nifty Consumer Durables', 'Nifty Energy', 'Nifty FMCG', 'Nifty Financial Services', 'Nifty Healthcare', 'Nifty IT', 'Nifty India Defence', 'Nifty Infrastructure', 'Nifty Media', 'Nifty Metal', 'Nifty Oil & Gas', 'Nifty PSE', 'Nifty PSU Bank', 'Nifty Pharma', 'Nifty Realty'].map(norm));
// NSE renamed its CNX indices to Nifty in Nov 2015 (same indices, same method): older files name them "S&P CNX 500", "CNX 500", "CNX Nifty", "CNX Midcap" and so on.
// canon() maps an old name to the current one so one series runs across the rename; a name with no clear current equivalent is left as it is (and so is dropped by KEEP).
const canon = (name) => {
  const n = name.replace(/^S&P\s+/i, '').trim();
  if (/^CNX Nifty$/i.test(n)) return 'Nifty 50';
  if (/^CNX (100|200|500)$/i.test(n)) return 'Nifty ' + n.slice(4);
  if (/^CNX Midcap$/i.test(n)) return 'Nifty Midcap 100';
  if (/^CNX Smallcap$/i.test(n)) return 'Nifty Smallcap 100';
  if (/^CNX /i.test(n)) return 'Nifty ' + n.slice(4);
  return name;
};
const sessions = readdirSync('data/india/bhav-hist').filter((f) => f.endsWith('.json.gz')).map((f) => f.slice(0, 10)).sort();
mkdirSync('data/india/idx-hist', { recursive: true });
const files = new Map(); const load = (y) => { if (!files.has(y)) { const p = `data/india/idx-hist/idx-${y}.json`; files.set(y, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}); } return files.get(y); };
const have = (iso) => Object.values(load(iso.slice(0, 4))).some((m) => m[iso]);
const save = () => { for (const [y, o] of files) writeFileSync(`data/india/idx-hist/idx-${y}.json`, JSON.stringify(o) + '\n'); };
let done = 0, missing = [];
for (const iso of sessions) {
  if (done >= MAX) break; if (have(iso)) continue;
  const name = `ind_close_all_${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}.csv`;
  let text = null;
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    for (let a = 0; a < 3 && text === null; a++) {
      try { const r = await fetch(`https://${host}/content/indices/${name}`, { headers: H }); if (r.status === 404) break; if (!r.ok) { await sleep(2000 * (a + 1)); continue; } const t = await r.text(); if (/^\s*<(!doctype|html)/i.test(t)) break; text = t; } catch { await sleep(2000 * (a + 1)); }
    }
    if (text !== null) break;
  }
  if (text === null) { missing.push(iso); continue; }
  let day; try { day = parseIndexCloseCsv(text); } catch (e) { missing.push(`${iso}: ${e.message.slice(0, 60)}`); continue; }
  if (day.date !== iso) { missing.push(`${iso}: file carries ${day.date}`); continue; }
  const o = load(iso.slice(0, 4));
  for (const r of day.rows) { const nm = canon(r.name); if (KEEP.has(norm(nm))) (o[nm] ??= {})[iso] = [r.open, r.high, r.low, r.close, r.volume]; }
  done++; if (done % 100 === 0) { save(); console.log('stored', done, iso); }
  await sleep(250);
}
save();
console.log(JSON.stringify({ stored: done, missingCount: missing.length, missing: missing.slice(0, 40) }));
