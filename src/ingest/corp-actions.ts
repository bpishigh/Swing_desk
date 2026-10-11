// Corporate-action adjustment for the India stock store. Pure functions, no I/O.
// A one-day move beyond the price band is a "break". For each break we look for an NSE corporate action that explains it, turn the
// action into a price factor, and accept it only if the adjusted day change looks like an ordinary trading day (<= 20%) and the
// next session does too. Anything that fails stays a break (averages omitted) and is reported; nothing is guessed into the decision numbers.
import { detectBreaks, type BhavDay, type Break, type CorpAdjustments } from './india-stocks.ts';

export interface Action { symbol: string; subject: string; exDate: string; faceVal?: string }   // exDate ISO
export type Kind = 'bonus' | 'split' | 'rights' | 'cash' | 'ncrps' | 'demerger' | 'other';
export interface Parsed { kind: Kind; factor: number | null; confidence: 'exact' | 'approx' | 'none'; subject: string }

const num = (s: string): number => Number(s.replace(/,/g, ''));

/** Read one action's subject into a price factor. `cum` = the stock's close before the ex-date (needed for rights). */
export function parseAction(a: Action, cum: number): Parsed {
  const s = a.subject;
  if (/ncrps/i.test(s)) return { kind: 'ncrps', factor: 1, confidence: 'exact', subject: s };
  let m = /Bonus (\d+):(\d+)/i.exec(s);
  if (m) { const x = num(m[1]), y = num(m[2]); return { kind: 'bonus', factor: y / (x + y), confidence: 'exact', subject: s }; }
  m = /From R[se]\.? ?([\d.]+)\/?-? Per Share To R[se]\.? ?([\d.]+)/i.exec(s);
  if (m) return { kind: 'split', factor: num(m[2]) / num(m[1]), confidence: 'exact', subject: s };
  m = /Rights (\d+):(\d+) @ Premium R[se]\.? ?([\d.]+)/i.exec(s);
  if (m) {
    const x = num(m[1]), y = num(m[2]), issue = num(a.faceVal ?? '0') + num(m[3]);
    return { kind: 'rights', factor: (y * cum + x * issue) / ((x + y) * cum), confidence: 'approx', subject: s };
  }
  if (/demerger|spin|amalgamation|arrangement|capital reduction/i.test(s)) return { kind: 'demerger', factor: null, confidence: 'none', subject: s };
  if (/dividend|interest|distribution|buy ?back|repayment/i.test(s)) return { kind: 'cash', factor: 1, confidence: 'exact', subject: s };
  return { kind: 'other', factor: null, confidence: 'none', subject: s };
}

export interface Override { factor?: number; ignore?: boolean; note?: string; /** factor was derived from a published average, not typed by a person */ derived?: boolean; /** factor read from an NSE circular (its number); accepted only if the price break agrees */ circular?: string }
export type Overrides = Record<string, Override>;     // key "SYMBOL|YYYY-MM-DD"

export interface Resolved { symbol: string; date: string; factor: number; kinds: string[]; confidence: 'exact' | 'approx' | 'override' | 'derived' | 'circular'; how: string; residualPct: number }
export interface Unresolved { symbol: string; date: string; ratio: number; reason: string; estimate?: { factor: number; basis: string } }
export interface Real { symbol: string; date: string; ratio: number }

const BAND = 0.20;
const CLEAN = [2, 3, 4, 5, 6, 8, 10, 20, 50, 100];

/** Nearest clean 1/n ratio within 6%, else null. */
export function cleanRatio(ratio: number): number | null {
  for (const n of CLEAN) if (Math.abs(ratio * n - 1) < 0.06) return 1 / n;
  return null;
}

function subsets<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let m = 1; m < 1 << xs.length; m++) out.push(xs.filter((_, i) => m & (1 << i)));
  return out.sort((a, b) => b.length - a.length);
}

export interface CircularMismatch { symbol: string; date: string; circular: string; factor: number; ratio: number }
export interface ResolveResult { options: CorpAdjustments; resolved: Resolved[]; unresolved: Unresolved[]; real: Real[]; circularMismatch: CircularMismatch[] }

/**
 * Resolve every break. `marketReturn(date)` is the broad-market (Nifty 500) return that day as a fraction, or null.
 */
export function resolveBreaks(days: BhavDay[], actions: Action[], overrides: Overrides, consecutive: (a: string, b: string) => boolean, marketReturn: (date: string) => number | null): ResolveResult {
  const bySym = new Map<string, Action[]>();
  for (const a of actions) { const l = bySym.get(a.symbol) ?? []; l.push(a); bySym.set(a.symbol, l); }
  const factors: Record<string, Array<{ date: string; factor: number }>> = {};
  const accepted: Record<string, string[]> = {};
  const resolved: Resolved[] = [], unresolved: Unresolved[] = [], real: Real[] = [], circularMismatch: CircularMismatch[] = [];

  for (const b of detectBreaks(days, consecutive)) {
    const key = `${b.symbol}|${b.date}`;
    const ov = overrides[key];
    const prevClose = days[b.index - 1].rows[b.symbol][5], close = days[b.index].rows[b.symbol][5];
    const nextRow = days[b.index + 1]?.rows[b.symbol];
    const nextOk = !nextRow || !consecutive(b.date, days[b.index + 1].date) || Math.abs(nextRow[5] / close - 1) <= BAND;
    const take = (f: number, kinds: string[], confidence: Resolved['confidence'], how: string) => {
      (factors[b.symbol] ??= []).push({ date: b.date, factor: f });
      resolved.push({ symbol: b.symbol, date: b.date, factor: Math.round(f * 1e6) / 1e6, kinds, confidence, how, residualPct: Math.round((b.ratio / f - 1) * 1000) / 10 });
    };
    if (ov?.ignore) { (accepted[b.symbol] ??= []).push(b.date); real.push({ symbol: b.symbol, date: b.date, ratio: b.ratio }); continue; }
    if (ov?.factor && ov.circular) {
      if (Math.abs(b.ratio / ov.factor - 1) <= BAND && nextOk) { take(ov.factor, ['circular'], 'circular', ov.note ?? ov.circular); continue; }
      circularMismatch.push({ symbol: b.symbol, date: b.date, circular: ov.circular, factor: ov.factor, ratio: Math.round(b.ratio * 10000) / 10000 });   // the circular does not explain this move: fall through to the list
    } else if (ov?.factor) { take(ov.factor, [ov.derived ? 'published average' : 'override'], ov.derived ? 'derived' : 'override', ov.note ?? 'override'); continue; }

    // Candidate ex-dates: the break day first, then one session either side.
    const tries: Array<{ date: string; how: string }> = [{ date: b.date, how: 'list' }];
    if (days[b.index - 1]) tries.push({ date: days[b.index - 1].date, how: 'list, date -1 session' });
    if (days[b.index + 1]) tries.push({ date: days[b.index + 1].date, how: 'list, date +1 session' });
    const mine = bySym.get(b.symbol) ?? [];
    let blocked = ''; let done = false; let listedCash = false;
    for (const t of tries) {
      const acts = mine.filter((a) => a.exDate === t.date).map((a) => ({ a, p: parseAction(a, prevClose) }));
      if (!acts.length) continue;
      if (acts.every((x) => x.p.kind === 'cash' || x.p.kind === 'ncrps')) { listedCash = true; continue; }
      const price = acts.filter((x) => x.p.factor !== null && x.p.factor !== 1);
      if (acts.some((x) => x.p.factor === null)) blocked = `${acts.find((x) => x.p.factor === null)!.p.kind}: the list gives no price ratio`;
      let best: { set: typeof price; f: number; res: number } | null = null;
      for (const sub of subsets(price)) {
        const f = sub.reduce((p, x) => p * x.p.factor!, 1);
        const res = b.ratio / f - 1;
        if (Math.abs(res) <= BAND && nextOk && (!best || Math.abs(res) < Math.abs(best.res) - 0.02)) best = { set: sub, f, res };
        if (best && sub.length === price.length) break;
      }
      if (best && !blocked) {
        const approx = best.set.some((x) => x.p.confidence === 'approx');
        take(best.f, best.set.map((x) => x.p.kind), approx ? 'approx' : 'exact', best.set.length < price.length ? `${t.how}, subset of the day's actions` : t.how);
        done = true; break;
      }
      if (!blocked) blocked = 'list ratio does not match the price move';
    }
    if (done) continue;

    // Unresolved: classify.
    const clean = cleanRatio(b.ratio);
    const noAction = !mine.some((a) => tries.some((t) => t.date === a.exDate) && !['cash', 'ncrps'].includes(parseAction(a, prevClose).kind));
    if (!blocked && noAction && !clean && ((b.ratio >= 0.75 && b.ratio < 0.78) || (b.ratio > 1.22 && b.ratio <= 1.6))) {
      (accepted[b.symbol] ??= []).push(b.date); real.push({ symbol: b.symbol, date: b.date, ratio: b.ratio }); continue;
    }
    const reason = blocked || (clean ? 'no action on the list and a clean 1/n price break (likely an ETF unit split)' : listedCash ? 'only a cash action listed for a large move' : 'no action on the list for a large move');
    const m = marketReturn(b.date);
    const estimate = clean ? { factor: clean, basis: 'nearest clean ratio' } : m !== null ? { factor: b.ratio / (1 + m), basis: 'price ratio less the market move that day' } : undefined;
    unresolved.push({ symbol: b.symbol, date: b.date, ratio: Math.round(b.ratio * 10000) / 10000, reason, ...(estimate ? { estimate } : {}) });
  }
  return { options: { factors, accepted }, resolved, unresolved, real, circularMismatch };
}

/** The extra factors that turn the unresolved breaks' estimates into adjustments (for the separate "estimated" averages only). */
export function estimateOptions(base: CorpAdjustments, unresolved: Unresolved[]): CorpAdjustments {
  const factors: Record<string, Array<{ date: string; factor: number }>> = {};
  for (const [k, v] of Object.entries(base.factors ?? {})) factors[k] = v.slice();
  for (const u of unresolved) if (u.estimate) (factors[u.symbol] ??= []).push({ date: u.date, factor: u.estimate.factor });
  return { factors, accepted: base.accepted };
}
