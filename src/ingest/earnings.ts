// Next results date for scan names (output only; changes no scan result). The desk's rule (now a flag, C-138): results should be more than 10 trading sessions away (src/engine/checklist.ts).
export const MIN_SESSIONS = 10;
const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/** Nasdaq's earnings-date reply: "...is estimated to report earnings on  10/30/2026." (or "will report"). Returns YYYY-MM-DD or null. */
export function parseNasdaqEarnings(json: unknown): { date: string | null; estimated: boolean } {
  const txt = String((json as { data?: { reportText?: string } })?.data?.reportText ?? '');
  const m = /earnings on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(txt);
  return { date: m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null, estimated: /estimated/i.test(txt) };
}
/** Nasdaq's earnings calendar for one day -> the symbols reporting that day. A second source for US names whose per-name page has no date (C-148 follow-up). */
export function parseNasdaqCalendar(json: unknown): string[] {
  const rows = (json as { data?: { rows?: unknown } })?.data?.rows;
  return Array.isArray(rows) ? rows.map((r) => String((r as { symbol?: unknown })?.symbol ?? '').trim().toUpperCase()).filter(Boolean) : [];
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

/** C-155: symbols whose next results date is today or within MIN_SESSIONS sessions. `dates` maps symbol -> YYYY-MM-DD. A symbol with no date is not in the set (the rule cannot act without one). */
export function resultsAvoid(dates: Record<string, string | undefined>, today: string, sessionsBetween: (a: string, b: string) => number): Set<string> {
  const out = new Set<string>();
  for (const [sym, d] of Object.entries(dates)) if (d && d >= today && sessionsBetween(today, d) <= MIN_SESSIONS) out.add(sym);
  return out;
}

/** NSE board-meeting rows for one symbol -> earliest meeting on or after `today` whose description mentions financial results. */
export function boardMeetingDate(rows: unknown, today: string): string | null {
  let best: string | null = null;
  if (!Array.isArray(rows)) return null;
  for (const r of rows as Array<Record<string, string>>) {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(r?.bm_date ?? '')); if (!m || !MON[m[2]]) continue;
    if (!/financial results|results/i.test(`${r.bm_purpose ?? ''} ${r.bm_desc ?? ''}`)) continue;
    const d = `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, '0')}`;
    if (d >= today && (!best || d < best)) best = d;
  }
  return best;
}

/** C-148 results rule. A scan name whose results are within MIN_SESSIONS sessions is not Ready: it moves to Watch with a wait tag and carries resultsBlock, which the paper books read. An unknown date changes nothing. Mutates and returns the scan; reports who moved. */
export function applyResultsRule<C extends { sym: string; tags?: string[]; resultsBlock?: { date: string | null; sessions: number | null } }>(scan: { ready: C[]; watch: C[] }, dates: Record<string, Earn | undefined>): { scan: { ready: C[]; watch: C[] }; demoted: string[]; blockedWatch: string[] } {
  const blocked = (c: C) => dates[c.sym]?.inWindow === true;
  const mark = (c: C): C => { const d = dates[c.sym] as Earn; c.resultsBlock = { date: d.date, sessions: d.sessions }; c.tags = [...(c.tags ?? []).filter((t) => !t.startsWith('results in ')), `results in ${d.sessions} session${d.sessions === 1 ? '' : 's'}: wait`]; return c; };
  const demoted = scan.ready.filter(blocked).map(mark); scan.ready = scan.ready.filter((c) => !blocked(c));
  for (const c of scan.watch) if (blocked(c)) mark(c);
  scan.watch = [...scan.watch, ...demoted];
  return { scan, demoted: demoted.map((c) => c.sym), blockedWatch: scan.watch.filter(blocked).map((c) => c.sym) };
}
