// Once a day (from the tick): alert by Telegram when the holiday calendar for the coming year is missing in December, or for this year at any time. State: data/ops/calendar-alert.json (one alert a day).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCalendarFiles, calendarAlert } from '../src/engine/calendar-files.ts';
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), SF = 'data/ops/calendar-alert.json';
const msg = calendarAlert(today, loadCalendarFiles().years);
if (!msg) { console.log('calendar files cover', today.slice(0, 4)); process.exit(0); }
const last = existsSync(SF) ? JSON.parse(readFileSync(SF, 'utf8')).lastAlert : null;
if (last === today) { console.log('already alerted today'); process.exit(0); }
console.log(msg);
try { execFileSync('node', ['scripts/alert.mjs', msg], { stdio: 'inherit' }); mkdirSync('data/ops', { recursive: true }); writeFileSync(SF, JSON.stringify({ lastAlert: today, message: msg }) + '\n'); } catch { console.error('alert not sent; will retry on the next tick'); process.exit(1); }
