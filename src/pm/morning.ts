// The "what changed" summary for the desk's front page (20 Oct 2026). Output only: no rule is applied or changed here.
// holding-alerts.mjs calls this each night with the day's exit-test labels, the labels from the night before and the NSE announced results dates.
// The card that shows it sits behind Cloudflare Access (it is read through /api/portfolio?view=morning), so it may name holdings.
import { makeCalendar } from '../engine/calendar.ts';

export interface HoldingRow { account: string; owner?: string; symbol: string; name: string; book?: string; value?: number | null; label: string; why?: string }
export interface Morning {
  asOf: string; previousAsOf: string | null; seeded: boolean;
  counts: { stocks: number; exit: number; keep: number; noVerdict: number };
  newExits: HoldingRow[]; recovered: Array<{ account: string; symbol: string; name: string }>;
  exits: HoldingRow[];                                           // everything that fails the test today, biggest first
  resultsDue: Array<{ symbol: string; name: string; account: string; date: string; sessions: number }>;
}
const key = (r: { account: string; symbol: string }) => `${r.account}|${r.symbol}`;

export function morningSummary(a: { asOf: string; previousAsOf: string | null; rows: HoldingRow[]; prev: Record<string, string>; seeded: boolean; resultsNext?: Record<string, string>; within?: number; names?: Record<string, string> }): Morning {
  const cal = makeCalendar(), within = a.within ?? 10, full = (r: HoldingRow): HoldingRow => ({ ...r, name: a.names?.[r.symbol] ?? r.name });
  a = { ...a, rows: a.rows.map(full) };
  const exits = a.rows.filter((r) => r.label === 'Exit').sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
  const newExits = a.seeded ? exits.filter((r) => a.prev[key(r)] !== 'Exit') : [];
  const recovered = a.seeded ? a.rows.filter((r) => r.label !== 'Exit' && a.prev[key(r)] === 'Exit').map((r) => ({ account: r.account, symbol: r.symbol, name: r.name })) : [];
  const resultsDue: Morning['resultsDue'] = [];
  for (const r of a.rows) {
    const d = a.resultsNext?.[r.symbol]; if (!d || d < a.asOf) continue;
    const n = cal.sessionsBetween(a.asOf, d); if (n <= within) resultsDue.push({ symbol: r.symbol, name: r.name, account: r.account, date: d, sessions: n });
  }
  resultsDue.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.symbol.localeCompare(y.symbol)));
  const n = (l: string) => a.rows.filter((r) => r.label === l).length;
  return { asOf: a.asOf, previousAsOf: a.previousAsOf, seeded: a.seeded, counts: { stocks: a.rows.length, exit: n('Exit'), keep: n('Keep'), noVerdict: n('No verdict') }, newExits, recovered, exits, resultsDue };
}
