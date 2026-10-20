// Writes the India sector snapshot (feed_hist/<date>.json) for earlier sessions that have none, from the stored index closes (no network).
// Same builder as the nightly job. Never overwrites a day. Usage: node scripts/india-feed-hist-history.mjs [--days=60]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { buildFeed } from '../src/ingest/india-index.ts';
const days = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=60').slice(7));
const cal = makeCalendar(loadCalendarFiles().india.holidays);
const store = JSON.parse(readFileSync('data/india/idx_closes.json', 'utf8'));
mkdirSync('data/india/feed_hist', { recursive: true });
let d = store.asOf, written = 0;
for (let k = 0; k < days; k++, d = cal.prevSession(d)) {
  const p = `data/india/feed_hist/${d}.json`;
  if (existsSync(p)) continue;
  const feed = buildFeed(store, d, new Date().toISOString(), 'rebuilt from stored NSE index closes');
  if (!Object.keys(feed.sectors).length) continue;
  writeFileSync(p, JSON.stringify({ date: d, bench: feed.bench, sectors: Object.fromEntries(Object.entries(feed.sectors).map(([k2, v]) => [k2, { close: v.close, sma50: v.sma50, sma200: v.sma200, r1m: v.r1m, r3m: v.r3m }])) }, null, 1) + '\n'); written++;
}
console.log(`written ${written}`);
