// Next results date for the scan's Ready and Watch names. Writes data/{us,india}/scan/earnings.json. Usage: node scripts/scan-earnings.mjs us|india
// US: Nasdaq's earnings-date page per name (an estimate until the company confirms). India: NSE's event calendar (announced board meetings for financial results).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { makeCalendar } from '../src/engine/calendar.ts';
import { parseNasdaqEarnings, indiaResultDates, boardMeetingDate, earnNote } from '../src/ingest/earnings.ts';
const market = process.argv[2]; if (!['us', 'india'].includes(market)) { console.error('usage: scan-earnings.mjs us|india'); process.exit(1); }
const rd = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const scan = rd(`data/${market}/scan/latest.json`, null); if (!scan) { console.log('no scan'); process.exit(0); }
const names = [...new Set([...scan.ready, ...scan.watch].map((c) => c.sym))];
const calJson = rd('data/calendar/markets-2026.json', {}); const cal = makeCalendar([...(calJson[market]?.holidays ?? []), ...(calJson[market]?.priorHolidays ?? [])]);
const today = scan.asOf; const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*' };
const dates = {}; let found = 0, failed = 0;
if (market === 'india') {
  try {
    const r = await fetch('https://www.nseindia.com/api/event-calendar', { headers: { ...UA, referer: 'https://www.nseindia.com/' }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('status ' + r.status);
    const m = indiaResultDates(await r.json(), today);
    // the whole market's announced results dates from this feed, kept for the Portfolio Manager's second source (build-pm-site.mjs merges it with the per-company board-meeting dates)
    writeFileSync('data/india/scan/results-calendar.json', JSON.stringify({ asOf: today, fetchedAt: new Date().toISOString(), dates: Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : 1))) }) + '\n');
    for (const s of names) {
      let d = m.get(s) ?? null;
      if (!d) { try { const r2 = await fetch(`https://www.nseindia.com/api/corporate-board-meetings?index=equities&symbol=${encodeURIComponent(s)}`, { headers: { ...UA, referer: 'https://www.nseindia.com/' }, signal: AbortSignal.timeout(20000) }); if (r2.ok) d = boardMeetingDate(await r2.json(), today); } catch { /* leave null */ } await new Promise((z) => setTimeout(z, 300)); }
 dates[s] = earnNote(d, today, cal.sessionsBetween.bind(cal)); if (d) found++;
    }
  } catch (e) { console.error('NSE calendar failed:', e.message); failed = names.length; }
} else {
  for (const s of names) {
    let d = null, est = false;
    for (let a = 0; a < 3 && d === null; a++) {
      try { const r = await fetch(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(s.replace('.', '-'))}/earnings-date`, { headers: { ...UA, origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('status ' + r.status); ({ date: d, estimated: est } = parseNasdaqEarnings(await r.json())); break; }
      catch { await new Promise((z) => setTimeout(z, 800 * (a + 1))); }
    }
    dates[s] = earnNote(d, today, cal.sessionsBetween.bind(cal), est); if (d) found++; else failed++;
    await new Promise((z) => setTimeout(z, 300));
  }
}
console.log(JSON.stringify({ market, names: names.length, found, failed }));
if (failed === names.length && names.length) process.exit(1);   // nothing read: keep yesterday's file
writeFileSync(`data/${market}/scan/earnings.json`, JSON.stringify({ asOf: today, source: market === 'us' ? 'Nasdaq earnings-date (estimates)' : 'NSE event calendar', dates }, null, 1) + '\n');
