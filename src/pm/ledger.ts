// Per-account FIFO replay (tax view): lots, realised sales with holding period, and breaks (sells with no matching buy).
// Breaks are never filled with an invented cost: the resolver (design 7.3) closes them from dated, sourced records.
import type { Trade } from './reader.ts';

export interface Lot { key: string; date: string; qty: number; unitCost: number; source: Trade }
export interface Realised { key: string; buyDate: string; sellDate: string; qty: number; cost: number; proceeds: number; gain: number; days: number; long: boolean | null }
export interface Break { key: string; instrument: string; date: string; qty: number; proceeds: number }
export interface Replay { open: Lot[]; realised: Realised[]; breaks: Break[] }

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const keyOf = (t: Trade) => t.isin || t.instrument.toUpperCase();

// `longAfterDays`: 365 for listed equity and equity funds (design section 7 rules table); null leaves the label unset.
export function replay(trades: Trade[], longAfterDays: number | null = 365): Replay {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1) || a.time.localeCompare(b.time));
  const lots = new Map<string, Lot[]>(); const realised: Realised[] = []; const breaks: Break[] = [];
  for (const t of ordered) {
    const k = keyOf(t); const q = lots.get(k) ?? lots.set(k, []).get(k)!;
    if (t.side === 'buy') { q.push({ key: k, date: t.date, qty: t.qty, unitCost: t.price, source: t }); continue; }
    let left = t.qty;
    while (left > 1e-9 && q.length) {
      const lot = q[0]; const take = Math.min(lot.qty, left);
      const d = days(lot.date, t.date);
      realised.push({ key: k, buyDate: lot.date, sellDate: t.date, qty: take, cost: take * lot.unitCost, proceeds: take * t.price, gain: take * (t.price - lot.unitCost), days: d, long: longAfterDays === null ? null : d > longAfterDays });
      lot.qty -= take; left -= take; if (lot.qty <= 1e-9) q.shift();
    }
    if (left > 1e-9) breaks.push({ key: k, instrument: t.instrument, date: t.date, qty: left, proceeds: left * t.price });
  }
  return { open: [...lots.values()].flat(), realised, breaks };
}
