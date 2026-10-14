// Fetches the Nifty 100, Midcap 150 and Smallcap 250 constituent lists from NSE and stores data/india/segments.json. At most weekly; keeps the old copy on any failure.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LISTS, parseIndexList, parseIndexIndustries } from '../src/ingest/segments.ts';
const OUT = 'data/india/segments.json', BASE = 'https://archives.nseindia.com/content/indices/';
const cur = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
if (cur && Date.now() - Date.parse(cur.fetchedAt) < 6 * 86400000) { console.log(`segments: copy from ${cur.fetchedAt} is recent; skipped`); process.exit(0); }
try {
  const next = { fetchedAt: new Date().toISOString(), industry: {} };
  for (const k of Object.keys(LISTS)) {
    const r = await fetch(BASE + LISTS[k].file, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' } });
    if (!r.ok) throw new Error(`${k}: status ${r.status}`);
    const text = await r.text(); next[k] = parseIndexList(text, k); Object.assign(next.industry, parseIndexIndustries(text));
  }
  writeFileSync(OUT, JSON.stringify(next, null, 1) + '\n');
  console.log(`segments: large ${next.large.length}, mid ${next.mid.length}, small ${next.small.length}`);
} catch (e) { console.log(`segments: fetch failed (${e.message}); ${cur ? 'keeping the copy from ' + cur.fetchedAt : 'no copy yet'}`); }
