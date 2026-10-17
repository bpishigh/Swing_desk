// US paper book (C-53): three paper streams on the US-SCAN-1 top-10 list, in a chain, each changing one thing from the one before.
//   official   : the live setups, stop-width cap and 3R room test as written
//   capwaived  : same shapes, triggers and fills; stop at the chart level but never wider than 2.5 ATR14, 12% skip line; cap and room tagged, not applied
//   comparator : stream 2's stop rule and tags, entered at the next close after a mechanical signal instead of at the pattern trigger
// Pure functions, no I/O. Exit rules at daily-close resolution (docs/replay/US-PAPER-BOOK-PREREG.md). No rule is changed and no real order is placed.
import { SCAN } from './us-scan-settings.ts';
import { SETUPS, LIMITS, type Light, type SetupId } from '../engine/setups.ts';
import { atrAt, emaAt, maxOf, minOf, smaAt, type Hist } from './us-scan.ts';

export type Stream = 'official' | 'capwaived' | 'comparator';
export const PAPER = {
  version: 'PAPER-1',
  maxAtrs: 2.5,            // stream 2 and 3: stop never wider than this many ATR14 from the trigger
  skipWidth: 0.12,         // stream 2 and 3: skip when the stop would be wider than this share of the trigger
  floorAtrs: SCAN.atrStopMult,
  maxHold: 60,
  breakoutLookback: 20,    // comparator: first close above the highest high of the previous 20 sessions
  backInLookback: 5,       // comparator pullbacks: a close below the average within the last 5 sessions
  tiers: [[100e6, 0.002], [25e6, 0.0035], [0, 0.006]] as Array<[number, number]>,
};
let tiers: Array<[number, number]> = PAPER.tiers;
/** Cost tiers by 20-day traded value in the market's own currency (descending). The US default is above; the India book sets its own before any call. */
export const useTiers = (t: Array<[number, number]>): void => { tiers = t; };
export const tierCost = (dv: number): number => { for (const [min, c] of tiers) if (dv >= min) return c; return tiers[tiers.length - 1][1]; };
const ok = (x: number): boolean => x === x;

export interface PaperPos {
  id: string; stream: Stream; sym: string; group: string | null; setup: SetupId; regime: Light; signalDate: string; signalIdx: number;
  status: 'pending' | 'open' | 'closed'; kind: 'trigger' | 'close';
  trigger: number; limit: number; basis: number; stopInitial: number; stop: number; atr14: number; atrPct: number; roomRef: number; overhead: number | null;
  tags: string[]; dv20: number; costPct: number; maxStopPct: number;
  entry?: number; entryDate?: string; entryIdx?: number; riskPerShare?: number; stopPct?: number; stopAtrs?: number; roomR?: number | null;
  left: number; pnlR: number; maxClose: number; thirdSold: boolean; extSold: boolean; pend: null | { kind: 'all' | 'third'; why: string };
  exitDate?: string; exitReason?: string; resultR?: number; heldSessions?: number; splitsApplied: string[]; note?: string;
}
export interface PaperBook { version: string; startDate: string; asOf: string | null; lastLight: Light | null; ledger: PaperPos[]; seq: number }
export const newBook = (startDate: string): PaperBook => ({ version: PAPER.version, startDate, asOf: null, lastLight: null, ledger: [], seq: 0 });

export interface Cand { sym: string; group: string | null; path: 'main' | 'ipo' }
export interface Shape {
  id: SetupId; basis: number; stopRaw: number; roomRef: number;
}
export interface Ctx {
  atr14: number; atrPct: number; close: number; pivot: number; dist: number; sma50: number; ema20: number; lowN: number; low10: number; overhead: number; tight: boolean; extended: boolean;
  s20hi: number; prevS20hi: number;
}
const roomOf = (overhead: number, roomRef: number, entry: number, stop: number): number | null => (overhead === overhead && overhead > roomRef && entry > stop ? (overhead - entry) / (entry - stop) : null);

export function context(hist: Hist, sym: string, t: number): Ctx | null {
  const s = hist.series.get(sym); if (!s) return null;
  const c = s.c, close = c[t]; if (!ok(close)) return null;
  const a14 = atrAt(s, t, 14), aS = atrAt(s, t, SCAN.atrShort), aL = atrAt(s, t, SCAN.atrLong), pivot = maxOf(s.h, t - SCAN.pivotSessions + 1, t), sma50 = smaAt(c, t, 50);
  const ratio = aS / aL;
  return {
    atr14: a14, atrPct: ok(a14) ? (a14 / close) * 100 : NaN, close, pivot, dist: (pivot - close) / pivot, sma50, ema20: emaAt(c, t, 20),
    lowN: minOf(s.l, t - SCAN.pullbackLookback + 1, t), low10: minOf(s.l, t - SCAN.stopLookback + 1, t), overhead: maxOf(s.h, t - SCAN.roomSessions + 1, t),
    tight: ok(ratio) && ratio < SCAN.atrTightRatio, extended: ok(sma50) && close > sma50 * (1 + SCAN.extendedAbove50),
    s20hi: maxOf(s.h, t - PAPER.breakoutLookback + 1, t), prevS20hi: maxOf(s.h, t - PAPER.breakoutLookback, t - 1),
  };
}

/** Every shape that matches, in the order 1 (or 1ipo), 2, 4, using the same tests as the scan and the regime's setup allowances. */
export function shapesOf(hist: Hist, cand: Cand, t: number, light: Light, x: Ctx): Shape[] {
  const s = hist.series.get(cand.sym)!, allowed = new Set<SetupId>(LIMITS.us[light].setups), close = x.close, h = s.h[t], out: Shape[] = [];
  if (x.extended) return out;
  const sid: SetupId = cand.path === 'ipo' ? '1ipo' : '1';
  if (allowed.has(sid) && (cand.path === 'ipo' || x.tight) && x.dist <= SCAN.pivotWithin) out.push({ id: sid, basis: x.pivot, stopRaw: x.low10, roomRef: x.pivot });
  if (cand.path === 'main' && allowed.has('2') && ok(x.ema20) && close >= x.ema20 && x.lowN <= x.ema20 && close > x.sma50) out.push({ id: '2', basis: h, stopRaw: x.lowN, roomRef: h });
  if (cand.path === 'main' && allowed.has('4') && close >= x.sma50 && x.lowN <= x.sma50) out.push({ id: '4', basis: h, stopRaw: x.lowN, roomRef: h });
  return out;
}

interface Built { trigger: number; limit: number; stop: number; widthPct: number; atrs: number; roomR: number | null; maxStopPct: number; insideBase: boolean }
/** Official stop rule (as the scan): the setup's chart level, widened to the 1.5 ATR14 floor. */
function officialLevels(shape: Shape, x: Ctx): Built | null {
  const sp = SETUPS[shape.id], trigger = shape.basis * (1 + sp.trig / 100), limit = trigger * (1 + sp.lim / 100);
  let stop = shape.stopRaw; if (ok(x.atr14) && stop > trigger - PAPER.floorAtrs * x.atr14) stop = trigger - PAPER.floorAtrs * x.atr14;
  if (!(trigger > stop) || !ok(x.atr14)) return null;
  return { trigger, limit, stop, widthPct: ((trigger - stop) / trigger) * 100, atrs: (trigger - stop) / x.atr14, roomR: roomOf(x.overhead, shape.roomRef, trigger, stop), maxStopPct: sp.maxStop, insideBase: false };
}
/** Stream 2 and 3 stop rule: never wider than 2.5 ATR14 below the trigger (tag inside base), skip when wider than 12%. */
function waivedLevels(shape: Shape, x: Ctx): Built | null {
  const b = officialLevels(shape, x); if (!b) return null;
  if (b.trigger - b.stop > PAPER.maxAtrs * x.atr14) { b.stop = b.trigger - PAPER.maxAtrs * x.atr14; b.insideBase = true; b.widthPct = ((b.trigger - b.stop) / b.trigger) * 100; b.atrs = PAPER.maxAtrs; b.roomR = roomOf(x.overhead, shape.roomRef, b.trigger, b.stop); }
  if (b.widthPct / 100 > PAPER.skipWidth) return null;
  return b;
}
const officialOk = (b: Built): boolean => b.widthPct <= b.maxStopPct && (b.roomR === null || b.roomR >= SCAN.roomR);

/** Comparator signal for tonight: breakout shape, first close above the previous 20-session high; pullback shapes, first close back above the 20-day (setup 2) or 50-day (setup 4) average. */
export function comparatorSignal(hist: Hist, cand: Cand, t: number, shape: Shape, x: Ctx): boolean {
  const s = hist.series.get(cand.sym)!, c = s.c;
  if (shape.id === '1' || shape.id === '1ipo') return ok(x.prevS20hi) && c[t] > x.prevS20hi && !(c[t - 1] > maxOf(s.h, t - 1 - PAPER.breakoutLookback, t - 2));
  const n = shape.id === '2' ? 20 : 50; const avg = (i: number) => smaAt(c, i, n);
  if (!(c[t] > avg(t))) return false;
  for (let k = 1; k <= PAPER.backInLookback; k++) if (ok(c[t - k]) && ok(avg(t - k)) && c[t - k] < avg(t - k)) return true;
  return false;
}

const dv20At = (hist: Hist, sym: string, t: number): number => { const s = hist.series.get(sym)!; let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (ok(s.c[i]) && ok(s.v[i])) { a += s.c[i] * s.v[i]; n++; } return n ? a / n : 0; };
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / (a.length || 1);

/** Create tonight's orders from the top-10 list. Skips a stream/ticker pair that already has an open or pending position. */
export function newOrders(book: PaperBook, hist: Hist, t: number, light: Light, cands: Cand[]): PaperPos[] {
  const date = hist.dates[t], made: PaperPos[] = [], busy = new Set(book.ledger.filter((p) => p.status !== 'closed').map((p) => p.stream + ':' + p.sym));
  for (const cand of cands) {
    const x = context(hist, cand.sym, t); if (!x) continue;
    const shapes = shapesOf(hist, cand, t, light, x); if (!shapes.length) continue;
    const dv = dv20At(hist, cand.sym, t), cost = tierCost(dv);
    const mk = (shape: Shape, stream: Stream, kind: 'trigger' | 'close', b: Built, tags: string[]) => {
      if (busy.has(stream + ':' + cand.sym)) return; busy.add(stream + ':' + cand.sym);
      made.push({ id: `${stream[0].toUpperCase()}${date.replace(/-/g, '')}-${cand.sym}`, stream, kind, sym: cand.sym, group: cand.group, setup: shape.id, regime: light, signalDate: date, signalIdx: t, status: 'pending',
        trigger: b.trigger, limit: b.limit, basis: shape.basis, stopInitial: b.stop, stop: b.stop, atr14: x.atr14, atrPct: x.atrPct, roomRef: shape.roomRef, overhead: ok(x.overhead) ? x.overhead : null,
        tags, dv20: dv, costPct: cost, maxStopPct: b.maxStopPct, stopPct: b.widthPct, stopAtrs: b.atrs, roomR: b.roomR, left: 1, pnlR: 0, maxClose: 0, thirdSold: false, extSold: false, pend: null, splitsApplied: [] });
    };
    const tagsOf = (b: Built): string[] => { const t2: string[] = []; if (b.insideBase) t2.push('inside base'); if (b.widthPct > b.maxStopPct) t2.push('over cap'); if (b.roomR !== null && b.roomR < SCAN.roomR) t2.push('room fail'); return t2; };
    for (const shape of shapes) { const off = officialLevels(shape, x); if (off && officialOk(off)) { mk(shape, 'official', 'trigger', off, []); break; } }
    for (const shape of shapes) { const cw = waivedLevels(shape, x); if (cw) { mk(shape, 'capwaived', 'trigger', cw, tagsOf(cw)); break; } }
    for (const shape of shapes) {
      const sh2: Shape = { ...shape, basis: x.close / (1 + SETUPS[shape.id].trig / 100) };    // stop placed from tonight's close; re-measured at the actual entry
      const cp = waivedLevels(sh2, x);
      if (cp && comparatorSignal(hist, cand, t, shape, x)) { mk(shape, 'comparator', 'close', cp, tagsOf(cp)); break; }
    }
  }
  book.ledger.push(...made); book.seq += made.length;
  return made;
}

const wkKey = (d: string): number => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return y * 100 + 1 + Math.round(((t.getTime() - j.getTime()) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); };
const lastOfWeek = (dates: string[], i: number): boolean => (i + 1 < dates.length ? wkKey(dates[i + 1]) !== wkKey(dates[i]) : new Date(dates[i] + 'T00:00:00Z').getUTCDay() === 5);
const emaFrom = (c: Float64Array, start: number, i: number, n: number): number => { let v = NaN; for (let k = Math.max(0, start); k <= i; k++) { if (!(c[k] > 0)) continue; v = v !== v ? c[k] : v + (2 / (n + 1)) * (c[k] - v); } return v; };
const LV: Record<string, number> = { red: 0, yellow: 1, green: 2 };

function close(p: PaperPos, date: string, idx: number, reason: string): void {
  p.status = 'closed'; p.exitDate = date; p.exitReason = reason; p.heldSessions = idx - (p.entryIdx as number) + 1;
  p.resultR = p.pnlR - (p.costPct * (p.entry as number)) / (p.riskPerShare as number);
}

/** One session for every open or pending position. `t` is the session index, `light` the regime light of the night, `prevLight` that of the night before (rule 9). */
export function advance(book: PaperBook, hist: Hist, t: number, light: Light, prevLight: Light | null): void {
  const date = hist.dates[t];
  for (const p of book.ledger) {
    if (p.status === 'closed') continue;
    const s = hist.series.get(p.sym); if (!s || !(s.c[t] > 0)) continue;
    if (p.status === 'pending') {
      if (t <= p.signalIdx) continue;
      if (t > p.signalIdx + 1) { p.status = 'closed'; p.exitReason = 'expired'; p.exitDate = date; continue; }
      let entry: number;
      if (p.kind === 'trigger') { if (!(s.h[t] >= p.trigger) || !(s.l[t] <= p.limit)) { p.status = 'closed'; p.exitReason = 'not filled'; p.exitDate = date; continue; } entry = p.trigger; }
      else {
        entry = s.c[t];
        // comparator: re-measure the stop at the actual entry
        const risk = entry - p.stop; if (!(risk > 0) || risk / entry > PAPER.skipWidth) { p.status = 'closed'; p.exitReason = 'skipped at entry'; p.exitDate = date; continue; }
        p.stopPct = (risk / entry) * 100; p.stopAtrs = risk / p.atr14; p.roomR = p.overhead !== null && p.overhead > entry ? (p.overhead - entry) / risk : null;
        p.tags = p.tags.filter((x) => x === 'inside base'); if (p.stopPct > p.maxStopPct) p.tags.push('over cap'); if (p.roomR !== null && p.roomR < SCAN.roomR) p.tags.push('room fail');
      }
      p.entry = entry; p.entryDate = date; p.entryIdx = t; p.riskPerShare = entry - p.stop; p.status = 'open'; p.maxClose = 0;
      if (p.kind === 'trigger') { p.stopPct = (p.riskPerShare / entry) * 100; p.stopAtrs = p.riskPerShare / p.atr14; }
    }
    // open: evaluate this session
    const E = p.entry as number, R = p.riskPerShare as number, e = p.entryIdx as number, i = t;
    const sell = (frac: number, price: number) => { p.pnlR += (frac * (price - E)) / R; p.left -= frac; };
    if (p.pend && i > e) {
      const q = p.pend; p.pend = null;
      if (q.kind === 'all') { sell(p.left, s.c[i]); close(p, date, i, q.why); continue; }
      sell(Math.min(p.left, 1 / 3), s.c[i]); if (q.why === 'r5') { p.thirdSold = true; p.stop = Math.max(p.stop, E); } else p.extSold = true;
    }
    if (s.l[i] <= p.stop) { sell(p.left, p.stop); close(p, date, i, p.stop >= E ? 'stop at entry' : 'stop'); continue; }
    const c = s.c[i], gain = (c - E) / R, sessions = i - e + 1; p.maxClose = Math.max(p.maxClose, c);
    const breakout = p.setup === '1' || p.setup === '1ipo';
    const ema20 = emaFrom(s.c, e - 60, i, 20);
    if (sessions >= PAPER.maxHold) { sell(p.left, c); close(p, date, i, 'max hold'); continue; }
    if (breakout && sessions <= 3 && c < p.basis) { p.pend = { kind: 'all', why: 'failed breakout' }; continue; }
    if (sessions >= 10 && p.maxClose < E + R) { p.pend = { kind: 'all', why: 'time stop' }; continue; }
    if (sessions < 35) { if (ok(ema20) && c < ema20) { p.pend = { kind: 'all', why: 'trail 20 EMA' }; continue; } }
    else if (lastOfWeek(hist.dates, i)) { const wc: number[] = []; for (let j = i; j >= 0 && wc.length < 10; j--) if (lastOfWeek(hist.dates, j) && s.c[j] > 0) wc.push(s.c[j]); if (wc.length === 10 && c < mean(wc)) { p.pend = { kind: 'all', why: 'trail 10 week' }; continue; } }
    if (!p.thirdSold && gain >= 2) { p.pend = { kind: 'third', why: 'r5' }; continue; }
    if (!p.extSold && ok(ema20) && c >= 1.2 * ema20) { p.pend = { kind: 'third', why: 'r7' }; continue; }
    if (prevLight && LV[light] < LV[prevLight] && gain < 1) { const ema10 = emaFrom(s.c, e - 60, i, 10); const up = Math.min(Math.max(s.l[i], ok(ema10) ? ema10 : -Infinity), c * 0.999); if (up > p.stop) p.stop = up; }
  }
}

/** Rescale levels when a split dated after the signal is now known (history is re-adjusted to it). */
export function applySplits(book: PaperBook, splits: Array<[string, string, number, number]>, asOf: string): void {
  for (const p of book.ledger) {
    if (p.status === 'closed') continue;
    for (const [sym, d, from, to] of splits) {
      if (sym !== p.sym || d <= p.signalDate || d > asOf || p.splitsApplied.includes(d) || !(from > 0 && to > 0)) continue;
      const f = from / to; p.splitsApplied.push(d);
      for (const k of ['trigger', 'limit', 'basis', 'stopInitial', 'stop', 'atr14', 'roomRef', 'maxClose'] as const) p[k] = p[k] * f;
      if (p.overhead !== null) p.overhead *= f;
      if (p.entry !== undefined) { p.entry *= f; p.riskPerShare = (p.riskPerShare as number) * f; }
    }
  }
}

/** Summary for the dashboard and the read: counts and R by stream. */
export function summarize(book: PaperBook): Record<string, unknown> {
  const out: Record<string, unknown> = { asOf: book.asOf, startDate: book.startDate, version: book.version };
  for (const st of ['official', 'capwaived', 'comparator'] as Stream[]) {
    const all = book.ledger.filter((p) => p.stream === st), done = all.filter((p) => p.status === 'closed' && p.resultR !== undefined), rs = done.map((p) => p.resultR as number);
    out[st] = { orders: all.length, open: all.filter((p) => p.status === 'open').length, pending: all.filter((p) => p.status === 'pending').length, notFilled: all.filter((p) => p.status === 'closed' && p.resultR === undefined).length, closed: done.length, meanR: done.length ? mean(rs) : null, winRate: done.length ? done.filter((p) => (p.resultR as number) > 0).length / done.length : null };
  }
  return out;
}
