// What an upload changed: the trades that were not in the account before, and which holdings that opened or closed. Pure; no I/O.
import { tradeKey, type Trade } from './reader.ts';

export interface UploadChange {
  at: string; added: number; buys: number; sells: number; firstDate: string | null; lastDate: string | null;
  opened: string[]; closed: string[]; names: string[];   // opened: held nothing before, holds now; closed: held before, holds nothing now
}
const nameOf = (t: Trade): string => t.symbol || t.instrument;
const net = (ts: Trade[]): Map<string, { n: number; name: string }> => {
  const m = new Map<string, { n: number; name: string }>();
  for (const t of ts) { const k = t.isin || t.instrument, e = m.get(k) ?? m.set(k, { n: 0, name: nameOf(t) }).get(k)!; e.n += t.side === 'buy' ? t.qty : -t.qty; }
  return m;
};
/** `before` is the account's trades ahead of the upload, `after` the merged list. */
export function uploadChange(before: Trade[], after: Trade[], at: string): UploadChange {
  const had = new Set(before.map(tradeKey)), fresh = after.filter((t) => !had.has(tradeKey(t)));
  const b = net(before), a = net(after), eps = 1e-6, opened: string[] = [], closed: string[] = [];
  for (const [k, v] of a) { const was = b.get(k)?.n ?? 0; if (was <= eps && v.n > eps) opened.push(v.name); }
  for (const [k, v] of b) { const now = a.get(k)?.n ?? 0; if (v.n > eps && now <= eps) closed.push(v.name); }
  const dates = fresh.map((t) => t.date).sort();
  return { at, added: fresh.length, buys: fresh.filter((t) => t.side === 'buy').length, sells: fresh.filter((t) => t.side === 'sell').length,
    firstDate: dates[0] ?? null, lastDate: dates.at(-1) ?? null, opened: opened.sort(), closed: closed.sort(), names: [...new Set(fresh.map(nameOf))].sort() };
}
export const ageDays = (iso: string, nowMs: number): number | null => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 86400000)) : null; };
