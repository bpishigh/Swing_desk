// Nightly alerts for the owner's own positions: open trades (the nine exit rules in src/engine/exits.ts) and the kept Legacy holdings (close at or below the stop, or below the 200 SMA).
// Moved from the Claude Desk's nightly tasks to the repo (17 Oct 2026). Pure: the script supplies the bars, the regime and the positions, and sends the message. Changes no rule.
import { evaluate, type OpenTrade, type Evening } from '../engine/exits.ts';
import { makeCalendar, type Calendar } from '../engine/calendar.ts';
import { emaAt, smaAt, type Series } from './us-scan.ts';

export type Market = 'india' | 'us';
export interface PositionTrade extends OpenTrade { market: Market; symbol: string; lastEval?: { date: string; close: number } }
export interface LegacyHolding { symbol: string; market: Market; status: 'pass' | 'unchecked' | 'fail' | 'exited'; stop?: number; stock?: string; bucket?: string }
export interface Positions { trades: PositionTrade[]; legacy: LegacyHolding[] }
export interface BookResult { market: Market; date: string; lines: string[]; trades: number; legacyKept: number; missing: string[]; updates: Array<{ symbol: string; maxClose: number; lastEval: { date: string; close: number } }> }

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const RANK: Record<string, number> = { red: 0, yellow: 1, green: 2 };
export const regimeDropped = (prev: string | null | undefined, cur: string | null | undefined): boolean => !!prev && !!cur && prev in RANK && cur in RANK && RANK[cur] < RANK[prev];

/** Inputs the exit rules need, from one stock's bars. Weekly figures only on the last session of the week (a Friday, or the day before a market holiday gap). */
export function eveningFrom(s: Series, dates: string[], t: number): Evening {
  const c = s.c, ev: Evening = { close: c[t], ema10: emaAt(c, t, 10), ema21: emaAt(c, t, 20), prevLow: s.l[t] };
  const wk = (d: string) => { const x = new Date(d + 'T00:00:00Z'); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x.toISOString().slice(0, 10); };
  const nextWeek = t + 1 >= dates.length ? false : wk(dates[t + 1]) !== wk(dates[t]);
  const lastOfWeek = nextWeek || new Date(dates[t] + 'T00:00:00Z').getUTCDay() === 5;
  if (lastOfWeek) {
    const closes: number[] = [], seen = new Set<string>();
    for (let i = t; i >= 0 && closes.length < 10; i--) { const w = wk(dates[i]); if (!seen.has(w)) { seen.add(w); closes.push(c[i]); } }
    if (closes.length === 10) { ev.wkClose = c[t]; ev.wk10 = closes.reduce((a, b) => a + b, 0) / 10; }
  }
  return ev;
}

export function bookAlerts(p: { market: Market; positions: Positions; dates: string[]; series: (sym: string) => Series | undefined; dropped: boolean; cal?: Calendar }): BookResult {
  const { market, positions, dates, series } = p, t = dates.length - 1, today = dates[t], cal = p.cal ?? makeCalendar();
  const lines: string[] = [], missing: string[] = [], updates: BookResult['updates'] = [];
  const trades = positions.trades.filter((x) => x.market === market && x.status === 'open');
  for (const tr of trades) {
    const s = series(tr.symbol);
    if (!s || !ok(s.c[t])) { missing.push(`${tr.symbol}: no close for ${today}`); continue; }
    const ev = eveningFrom(s, dates, t);
    const r = evaluate(tr, ev, today, market, p.dropped, cal);
    for (const a of r.acts) if (a.c !== 'a-info' && a.r !== 'Rule 1') lines.push(`${tr.symbol}: ${a.r}. ${a.t}`);
    updates.push({ symbol: tr.symbol, maxClose: Math.max(tr.maxClose ?? -Infinity, s.c[t]), lastEval: { date: today, close: s.c[t] } });
  }
  const kept = positions.legacy.filter((x) => x.market === market && x.status === 'pass');
  for (const l of kept) {
    const s = series(l.symbol);
    if (!s || !ok(s.c[t])) { missing.push(`${l.symbol}: no close for ${today}`); continue; }
    const close = s.c[t], s200 = smaAt(s.c, t, 200);
    if (ok(l.stop) && close <= l.stop) lines.push(`${l.symbol} (Legacy): closed ${close} at or below its stop ${l.stop}. Sell.`);
    else if (ok(s200) && close < s200) lines.push(`${l.symbol} (Legacy): closed ${close} below its 200 SMA ${Math.round(s200 * 100) / 100}. Fails the exit test.`);
  }
  return { market, date: today, lines, trades: trades.length, legacyKept: kept.length, missing, updates };
}
