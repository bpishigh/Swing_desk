// Computes the regime for the latest stored tracker day with the same engine as the app, and sends one phone message when it changes
// (or a distribution / follow-through day appears). Needs the day's breadth; exits quietly while either input is missing.
// Usage: node scripts/regime-run.mjs <india|us> [--dry]
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeCalendar } from '../src/engine/calendar.ts';
import { regimeReport } from '../src/ingest/regime-run.ts';
const market = process.argv[2]; if (!['india', 'us'].includes(market)) { console.error('usage: regime-run.mjs <india|us>'); process.exit(2); }
const DRY = process.argv.includes('--dry');
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const calFile = JSON.parse(readFileSync('data/calendar/markets-2026.json', 'utf8'))[market];
const cal = makeCalendar([...calFile.holidays, ...(calFile.priorHolidays || [])]);
const dir = `data/${market}/tracker`;
const files = readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(-130);
const breadth = read(`data/${market}/breadth.json`, {});
const rows = files.map((f) => { const date = f.slice(0, 10), d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); return { ...d, date, ...(breadth[date] ? { breadth: breadth[date].pct } : {}) }; });
if (!rows.length) { console.log('no tracker days'); process.exit(0); }
const D = rows[rows.length - 1].date;
if (!breadth[D]) { console.log(`waiting: no breadth for ${D} yet`); process.exit(0); }
const statePath = `data/${market}/regime.json`;
const state = read(statePath, {});
if (state.latest?.date === D) { console.log(`${D} already done: ${state.latest.name}`); process.exit(0); }
const label = market === 'india' ? 'India' : 'US';
const opts = { cal };
const prev = rows.length > 1 ? regimeReport(label, rows.slice(0, -1), opts, null) : null;
const cur = regimeReport(label, rows, opts, prev?.record ?? null);
if (!cur) { console.log('tracker has no averages for the latest day'); process.exit(0); }
const next = { latest: cur.record, ...(state.alertedFor ? { alertedFor: state.alertedFor } : {}) };
console.log(JSON.stringify({ date: D, regime: cur.record.name, breadth: cur.record.breadth, distribution: cur.record.distribution, followThrough: cur.record.followThrough, alert: cur.alert }));
if (DRY) process.exit(0);
let failed = false;
if (cur.alert && state.alertedFor !== D) {
  try { execFileSync('node', ['scripts/alert.mjs', cur.alert], { stdio: 'inherit' }); next.alertedFor = D; }
  catch { console.error('alert could not be sent; the next run will try again'); failed = true; }
}
if (!failed) writeFileSync(statePath, JSON.stringify(next, null, 1) + '\n');
process.exit(failed ? 1 : 0);
