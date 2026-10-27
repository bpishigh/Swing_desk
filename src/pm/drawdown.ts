// Worst fall from a peak in the portfolio's own history, with money added or taken out removed so a deposit never hides a fall.
// Compared with the drawdown limit the allocation sets (equity share x assumed bear-market fall). A flag, never an order.
import type { DayValue } from './valuation.ts';

export interface Drawdown { depth: number; peak: string; trough: string; days: number; current: number }

/** `invested` is the cost of what is held, so its day-to-day change is the money put in (or taken out). Days with a missing price are skipped. */
export function worstDrawdown(series: DayValue[] | null, since?: string): Drawdown | null {
  if (!series || series.length < 20) return null;
  let idx = 1, peak = 1, peakDate = '', best: Drawdown = { depth: 0, peak: '', trough: '', days: 0, current: 0 }, prev: DayValue | null = null, started = false;
  for (const d of series) {
    if (since && d.date < since) { prev = d; continue; }
    if (prev && prev.value > 0 && !prev.missingPrices && !d.missingPrices) {
      const r = (d.value - (d.invested - prev.invested)) / prev.value - 1;
      if (Number.isFinite(r) && r > -0.5) idx *= 1 + r;
    }
    if (!started) { started = true; peak = idx; peakDate = d.date; }
    if (idx > peak) { peak = idx; peakDate = d.date; }
    const dd = (peak - idx) / peak;
    if (dd > best.depth) best = { depth: dd, peak: peakDate, trough: d.date, days: Math.round((Date.parse(d.date) - Date.parse(peakDate)) / 86400000), current: 0 };
    best.current = dd; prev = d;
  }
  return started ? best : null;
}
