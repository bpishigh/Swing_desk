// Market calendar: which days are sessions, and counting sessions. Engine Rules count sessions (3 sessions for a failed breakout,
// 10 for the time stop, 25 for distribution days, 10 for breadth confirmation, results more than 10 trading days away), so they
// must skip exchange holidays as well as weekends. Resolves Architecture decision 8 for the engine; data is data/calendar/markets-2026.json.
// WEEKDAYS (no holidays) is what v9 used and is the default, so replays against v9 are unchanged.
const parse = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const dayNo = (s: string): number => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
/** Weekdays from the epoch up to and including day t (t = days since 1970-01-01, a Thursday): O(1), so counting sessions is cheap. */
const weekdaysThrough = (t: number): number => { const k = t + 3; return Math.floor(k / 7) * 5 + Math.min((k % 7) + 1, 5); };

export interface Calendar {
  isSession(date: string): boolean;
  /** Sessions after `a` up to and including `b`. 0 when b is not after a or either date is missing. */
  sessionsBetween(a?: string, b?: string): number;
  /** The date n sessions after `date` (n >= 0). */
  addSessions(date: string, n: number): string;
  /** The last session strictly before `date`. */
  prevSession(date: string): string;
}

export function makeCalendar(holidays: Iterable<string> = []): Calendar {
  const hol = new Set(holidays);
  const holDays = [...hol].map(dayNo).filter((t) => { const w = (((t + 4) % 7) + 7) % 7; return w !== 0 && w !== 6; }); // weekday holidays only
  const isSession = (date: string): boolean => { const w = parse(date).getUTCDay(); return w !== 0 && w !== 6 && !hol.has(date); };
  return {
    isSession,
    sessionsBetween(a, b) {
      if (!a || !b || b <= a) return 0;
      const ta = dayNo(a), tb = dayNo(b);
      let n = weekdaysThrough(tb) - weekdaysThrough(ta);
      for (const h of holDays) if (h > ta && h <= tb) n--;
      return n;
    },
    addSessions(date, n) {
      const d = parse(date); let left = n;
      while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (isSession(iso(d))) left--; }
      return iso(d);
    },
    prevSession(date) {
      const d = parse(date);
      do { d.setUTCDate(d.getUTCDate() - 1); } while (!isSession(iso(d)));
      return iso(d);
    },
  };
}
/** Weekends only, no holidays: the v9 behaviour. */
export const WEEKDAYS: Calendar = makeCalendar();

export interface CalendarFile { india: { holidays: string[] }; us: { holidays: string[] } }
export const calendarFor = (file: CalendarFile, market: 'india' | 'us'): Calendar => makeCalendar(file[market].holidays);
