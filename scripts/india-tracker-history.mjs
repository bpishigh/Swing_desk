// One-off / repair: writes the Nifty 50 tracker day (close, high, low, volume, averages, Nifty 500 as `b`, VIX) for earlier sessions that have none,
// so the regime has the 25+ sessions it needs for distribution days. Same builder and same NSE file as the nightly job; never overwrites a day.
// Usage: node scripts/india-tracker-history.mjs [--days=60]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { parseIndexCloseCsv, buildTracker } from '../src/ingest/india-index.ts';
const days = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=60').slice(7));
const cal = makeCalendar(loadCalendarFiles().india.holidays);
const store = JSON.parse(readFileSync('data/india/idx_closes.json', 'utf8'));
const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: '*/*', referer: 'https://www.nseindia.com/' };
const dd = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
let d = store.asOf; const list = [];
for (let k = 0; k < days; k++, d = cal.prevSession(d)) list.push(d);
let written = 0; const missing = [];
mkdirSync('data/india/tracker', { recursive: true });
for (const iso of list.reverse()) {
  const p = `data/india/tracker/${iso}.json`;
  if (existsSync(p)) continue;
  const r = await fetch(`https://archives.nseindia.com/content/indices/ind_close_all_${dd(iso)}.csv`, { headers: H });
  if (!r.ok) { missing.push(`${iso}: ${r.status}`); continue; }
  const text = await r.text();
  if (/^\s*<(!doctype|html)/i.test(text)) { missing.push(`${iso}: html`); continue; }
  try {
    const day = parseIndexCloseCsv(text);
    if (day.date !== iso) { missing.push(`${iso}: file carries ${day.date}`); continue; }
    const row = buildTracker(store, day, new Date().toISOString(), 'NSE index close file (history added later)');
    if (!row) { missing.push(`${iso}: no row`); continue; }
    writeFileSync(p, JSON.stringify(row, null, 1) + '\n'); written++;
  } catch (e) { missing.push(`${iso}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 400));
}
console.log(JSON.stringify({ written, missing }));
