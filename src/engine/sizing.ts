// Entry calculation: trigger, limit, stop, size. Implements Engine Rules "Setups and entry calculation" and
// "Entry mechanics and book rules" (60/40 entry, pilot size, 20% position cap). Ported from app v9 ntCalc.
import { SETUPS, type SetupId } from './setups.ts';
import type { Light } from './setups.ts';

export interface SectorFlags { persist: boolean; newLeader: boolean; above200: boolean | null }
export interface NtInput {
  setup: SetupId;
  basis: number;          // pivot / day high per the setup
  chartStop: number;
  atr?: number;           // ATR(14) in price units
  close?: number;         // last close (reference for ATR %)
  resistance?: number;    // nearest overhead resistance
  capital: number;
  light: Light | null;    // null = regime not saved
  riskBase: number;       // risk per trade after proven-Green, VIX and risk-halving adjustments (done outside)
  sector?: SectorFlags | null;
  bottomUp?: boolean;
}
export interface NtResult {
  trigger?: number; limit?: number; atrPct?: number; volatile?: boolean; entry?: number; floored?: boolean;
  stop?: number; rps?: number; stopPct?: number; pilot?: boolean; early?: boolean; riskPct?: number; oneR?: number;
  full?: number; first?: number; add?: number; capped?: boolean; pos?: number; posPct?: number; p1?: number; p2?: number; room?: number;
}
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function ntCalc(i: NtInput): NtResult {
  const setup = SETUPS[i.setup] ?? SETUPS['1'];
  const out: NtResult = {};
  if (!(i.basis > 0) || !(i.chartStop > 0)) return out;
  if (!ok(i.capital)) return out;
  out.trigger = i.basis * (1 + setup.trig / 100);
  out.limit = out.trigger * (1 + setup.lim / 100);
  const refPx = ok(i.close) && i.close > 0 ? i.close : i.basis;
  out.atrPct = ok(i.atr) && i.atr > 0 ? (i.atr / refPx) * 100 : NaN;
  out.volatile = ok(out.atrPct) && out.atrPct > 3; // ATR above 3% means close-confirmed entry
  const entry = out.trigger; out.entry = entry;
  let stop = i.chartStop; out.floored = false;
  if (ok(i.atr) && i.atr > 0 && entry - i.chartStop < 1.5 * i.atr) { stop = entry - 1.5 * i.atr; out.floored = true; }
  out.stop = stop; out.rps = entry - stop; out.stopPct = (out.rps / entry) * 100;
  const ss = i.sector ?? null;
  let riskPct = i.light ? i.riskBase : 0.25; out.pilot = false;
  const red = i.light === 'red';
  if (!red && ss && !ss.persist && ss.newLeader) { riskPct = Math.min(riskPct, 0.25); out.pilot = true; }
  if (i.bottomUp && !(ss && ss.persist)) { riskPct = Math.min(riskPct, 0.25); out.pilot = true; }
  if (!red && ss && ss.above200 === false) { riskPct = Math.min(riskPct, 0.25); out.pilot = true; out.early = true; }
  out.riskPct = riskPct; out.oneR = (i.capital * riskPct) / 100;
  if (out.rps > 0) {
    let full = Math.floor(out.oneR / out.rps);
    const cap20 = Math.floor((i.capital * 0.2) / entry); // position cap: 20% of capital
    out.capped = full > cap20; full = Math.min(full, cap20);
    out.full = full; out.first = Math.floor(full * 0.6); out.add = full - out.first;
    out.pos = full * entry; out.posPct = (out.pos / i.capital) * 100;
    out.p1 = entry + out.rps; out.p2 = entry + 2 * out.rps;
    out.room = ok(i.resistance) && i.resistance > 0 ? (i.resistance - entry) / out.rps : NaN;
  }
  return out;
}
