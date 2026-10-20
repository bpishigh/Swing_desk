// Loads every data/calendar/markets-<year>.json and merges them, so a new year is a new file and no script names a year (20 Oct 2026).
// Before this, about a dozen scripts read markets-2026.json directly: from 1 Jan 2027 they would have counted exchange holidays as sessions.
// The result has the same shape as one file ({india:{holidays,...}, us:{holidays,...}}); date lists are the sorted union across years, other fields come from the latest year.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

type Market = Record<string, unknown>;
export type CalendarFiles = { note?: string; checkedAgainst?: string; india: Market & { holidays: string[] }; us: Market & { holidays: string[] }; years: number[] };

export function mergeCalendars(files: Array<{ year: number; data: any }>): CalendarFiles {
  const sorted = [...files].sort((a, b) => a.year - b.year);
  const out: any = { years: sorted.map((f) => f.year) };
  for (const m of ['india', 'us']) {
    const merged: Market = {};
    for (const f of sorted) for (const [k, v] of Object.entries(f.data?.[m] ?? {})) {
      if (Array.isArray(v)) merged[k] = [...new Set([...((merged[k] as string[]) ?? []), ...(v as string[])])].sort();
      else merged[k] = v;                                            // notes and the like: the latest year's wins
    }
    merged.holidays ??= [];
    out[m] = merged;
  }
  const last = sorted[sorted.length - 1]?.data; out.note = last?.note; out.checkedAgainst = last?.checkedAgainst;
  return out as CalendarFiles;
}
export function loadCalendarFiles(dir = 'data/calendar'): CalendarFiles {
  const files = existsSync(dir) ? readdirSync(dir).map((f) => /^markets-(\d{4})\.json$/.exec(f)).filter((m): m is RegExpExecArray => !!m).map((m) => ({ year: +m[1], data: JSON.parse(readFileSync(`${dir}/${m[0]}`, 'utf8')) })) : [];
  if (!files.length) throw new Error(`no ${dir}/markets-<year>.json file`);
  return mergeCalendars(files);
}
/** The December check: the next year's file must exist from 1 Dec (the exchanges publish their holiday lists in the autumn). Returns the message to send, or null. */
export function calendarAlert(today: string, years: number[]): string | null {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  if (m < 12) return years.includes(y) ? null : `no holiday calendar for ${y}: add data/calendar/markets-${y}.json now`;
  return years.includes(y + 1) ? null : `no holiday calendar for ${y + 1} yet: add data/calendar/markets-${y + 1}.json before 1 Jan (NSE and NYSE publish their lists in the autumn)`;
}
