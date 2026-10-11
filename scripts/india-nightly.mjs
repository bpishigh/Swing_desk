// Repo Desk nightly India job (index feed slice). Downloads NSE's official index close file, adds it to the stored history,
// and writes the feed and tracker JSON with a source and as-of date on every number.
// Usage: node scripts/india-nightly.mjs [--date=YYYY-MM-DD] [--dir=data/india] [--offline=<folder of ind_close_all_DDMMYYYY.csv>]
// Exit 0 = wrote the day, or the day's file is not published yet (nothing written). Exit 1 = anything wrong; a failed run never writes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCalendar } from '../src/engine/calendar.ts';
import { parseIndexCloseCsv, mergeDay, buildFeed, buildTracker, jumpFlags } from '../src/ingest/india-index.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const DIR = arg('dir') || 'data/india';
const OFFLINE = arg('offline');
const cal = makeCalendar(JSON.parse(readFileSync('data/calendar/markets-2026.json', 'utf8')).india.holidays);
const pad = (n) => String(n).padStart(2, '0');
const istNow = new Date(Date.now() + 5.5 * 3600e3);
const todayIst = istNow.toISOString().slice(0, 10);
const ddmmyyyy = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;

// D = the latest session on or before today (IST), unless given.
let D = arg('date');
if (!D) { D = todayIst; while (!cal.isSession(D)) D = cal.prevSession(D); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/' };

/** Returns csv text, or null on 404 (not published / not a session). Throws on anything else. */
async function getFile(iso) {
  const name = `ind_close_all_${ddmmyyyy(iso)}.csv`;
  if (OFFLINE) { const p = join(OFFLINE, name); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
  // archives.nseindia.com answers 404 for a file that does not exist; nsearchives answers 200 with a "not accessible in your region" page
  // for a missing file. So: 404 on archives, then HTML on nsearchives, means "not published yet", not an error.
  let lastErr, sawMissing = false;
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    for (let a = 0; a < 3; a++) {
      try {
        const res = await fetch(`https://${host}/content/indices/${name}`, { headers: H, redirect: 'follow' });
        if (res.status === 404) { sawMissing = true; break; }
        if (!res.ok) { lastErr = new Error(`${host} ${res.status}`); await new Promise((r) => setTimeout(r, 2000 * (a + 1))); continue; }
        const text = await res.text();
        if (/^\s*<(!doctype|html)/i.test(text)) { if (sawMissing) break; lastErr = new Error(`${host} returned HTML`); break; }
        return text;
      } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 2000 * (a + 1))); }
    }
  }
  if (sawMissing) return null;
  if (lastErr) throw lastErr;
  return null;
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, o) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(o, null, 1) + '\n'); };
const report = { ts: new Date().toISOString(), date: D, status: 'unknown', gapFilled: [], notPublished: [], added: 0, missingNames: [], conflicts: [], flags: [] };
const finish = (code, status, extra = {}) => { Object.assign(report, { status }, extra); write(join(DIR, 'last-run.json'), report); console.log(JSON.stringify(report)); process.exit(code); };

let store = read(join(DIR, 'idx_closes.json'));
if (D <= store.asOf && Object.values(store.closes).every((h) => D in h)) finish(0, 'already stored', {});

// Sessions after the stored history up to D (inclusive), oldest first. At most 10 gap days per run.
const todo = [];
for (let d = store.asOf; d < D;) { d = cal.addSessions(d, 1); todo.push(d); }
if (todo.length > 10) finish(1, 'too many missing sessions', { flags: [`${todo.length} sessions missing after ${store.asOf}; refusing to backfill more than 10 in one run`] });

let dayD = null;
for (const iso of todo) {
  const text = await getFile(iso).catch((e) => finish(1, 'fetch error', { flags: [`${iso}: ${e.message}`] }));
  if (text === null) { report.notPublished.push(iso); if (iso === D) break; continue; }
  let day;
  try { day = parseIndexCloseCsv(text); } catch (e) { finish(1, 'parse error', { flags: [`${iso}: ${e.message}`] }); }
  if (day.date !== iso) finish(1, 'wrong date in file', { flags: [`file for ${iso} carries ${day.date}`] });
  const m = mergeDay(store, day);
  report.conflicts.push(...m.conflicts); report.missingNames.push(...m.missing.map((k) => `${iso} ${k}`));
  store = m.store; report.added += m.added.length;
  report.flags.push(...jumpFlags(store, iso).map((f) => `${iso} ${f}`));
  if (iso === D) dayD = day; else report.gapFilled.push(iso);
}

if (report.conflicts.length || report.missingNames.length) {
  finish(1, 'file disagrees with history or lacks a required index', {});
}
if (!dayD) finish(0, `file for ${D} not published yet`, {});

const fetchedAt = new Date().toISOString();
const src = `NSE index close file (${D.slice(8)}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+D.slice(5, 7) - 1]}-${D.slice(0, 4)}) + computed averages/returns`;
const feed = buildFeed(store, D, fetchedAt, src);
const tracker = buildTracker(store, dayD, fetchedAt, 'NSE index close file');
if (!tracker) finish(1, 'could not build the Nifty 50 tracker row', {});
write(join(DIR, 'idx_closes.json'), store);
write(join(DIR, 'feed', 'latest.json'), feed);
write(join(DIR, 'feed_hist', `${D}.json`), {
  date: D, bench: feed.bench,
  sectors: Object.fromEntries(Object.entries(feed.sectors).map(([k, v]) => [k, { close: v.close, sma50: v.sma50, sma200: v.sma200, r1m: v.r1m, r3m: v.r3m }])),
});
write(join(DIR, 'tracker', `${D}.json`), tracker);
finish(0, 'written', { flags: [...report.flags, ...feed.flags, ...tracker.flags.filter((f) => !/basis versus/.test(f))] });
