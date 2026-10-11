// Turns the stored tracker days and breadth into a regime for the latest day and decides whether the phone needs a message.
// Pure: the script reads the files and sends the alert.
import { regimeFrom, LEVEL_NAME, type TrackerRow, type RegimeOptions } from '../engine/regime.ts';

export interface RegimeRecord { date: string; name: string; notes: string[]; breadth: number | null; breadthDate?: string; distribution: number; followThrough: string }
export interface RegimeState { [date: string]: RegimeRecord }

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** rows oldest first. `prev` = the record for the day before (null if none). */
export function regimeReport(market: 'India' | 'US', rows: TrackerRow[], opts: RegimeOptions, prev: RegimeRecord | null): { record: RegimeRecord; alert: string | null } | null {
  const r = regimeFrom(rows, opts);
  if (!r || r.incomplete) return null;
  const date = rows[rows.length - 1].date;
  const record: RegimeRecord = {
    date, name: r.name, notes: r.notes, breadth: Number.isFinite(r.breadth) ? r.breadth : null, ...(r.breadthDate ? { breadthDate: r.breadthDate } : {}),
    distribution: r.analysis.active.length, followThrough: r.analysis.status,
  };
  const lines: string[] = [];
  if (prev && prev.name !== r.name) lines.push(`${market} regime: ${cap(prev.name)} → ${cap(r.name)} (${date}).${r.notes.length ? ' ' + r.notes.join('; ') + '.' : ''}`);
  else if (prev) {
    if (r.analysis.active.length > prev.distribution) lines.push(`${market}: new distribution day, ${r.analysis.active.length} in the last 25 sessions. Regime stays ${cap(r.name)}.`);
    if (r.analysis.status === 'confirmed' && prev.followThrough !== 'confirmed') lines.push(`${market}: follow-through day confirmed. Regime stays ${cap(r.name)}.`);
    else if (r.analysis.status === 'active' && prev.followThrough !== 'active' && prev.followThrough !== 'confirmed') lines.push(`${market}: follow-through day today. Regime stays ${cap(r.name)}.`);
    if (r.analysis.status === 'failed' && prev.followThrough !== 'failed') lines.push(`${market}: follow-through failed. Regime stays ${cap(r.name)}.`);
  }
  return { record, alert: lines.length ? lines.join('\n') : null };
}
export { LEVEL_NAME };
