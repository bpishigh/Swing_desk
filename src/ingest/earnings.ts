// Next results date for scan names (output only; changes no scan result). The desk's rule: results must be more than 10 trading sessions away (src/engine/checklist.ts).
export const MIN_SESSIONS = 10;
const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/** Nasdaq's earnings-date reply: "...is estimated to report earnings on  10/30/2026." (or "will report"). Returns YYYY-MM-DD or null. */
export function parseNasdaqEarnings(json: unknown): { date: string | null; estimated: boolean } {
  const txt = String((json as { data?: { reportText?: string } })?.data?.reportText ?? '');
  const m = /earnings on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(txt);
  return { date: m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null, estimated: /estimated/i.test(txt) };
}
/** NSE event calendar rows -> earliest announced "Financial Results" date on or after `today`, by symbol. */
export function indiaResultDates(rows: unknown, today: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(rows)) return out;
  for (const r of rows as Array<Record<string, string>>) {
    if (!r?.symbol || !/financial results/i.test(String(r.purpose ?? ''))) continue;
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(r.date ?? '')); if (!m || !MON[m[2]]) continue;
    const d = `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, '0')}`;
    if (d < today) continue;
    const o = out.get(r.symbol); if (!o || d < o) out.set(r.symbol, d);
  }
  return out;
}
export interface Earn { date: string | null; sessions: number | null; inWindow: boolean | null; estimated?: boolean }
export function earnNote(date: string | null, today: string, sessionsBetween: (a: string, b: string) => number, estimated = false): Earn {
  if (!date) return { date: null, sessions: null, inWindow: null };
  const s = sessionsBetween(today, date);
  return { date, sessions: s, inWindow: s <= MIN_SESSIONS, ...(estimated ? { estimated } : {}) };
}
