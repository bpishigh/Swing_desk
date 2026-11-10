// First-wave monthly scorecard (Engine Rules C-174 kill line, C-176 comparator, C-177 confidence). Pure: month-end series in, figures out.
import { confidenceOf, type Confidence } from './confidence.ts';
export interface MV { m: string; v: number }
export interface Pair { m: string; b: number; c: number; x: number }
const get = (s: MV[]): Map<string, number> => new Map(s.filter((x) => x.v > 0).map((x) => [x.m, x.v]));

/** Monthly returns of the book against the comparator over the same month-ends. The book's first month-end is the base; a month missing either value is left out. */
export function paired(book: MV[], comp: MV[]): Pair[] {
  const cm = get(comp), out: Pair[] = [], bs = book.filter((x) => x.v > 0);
  for (let i = 1; i < bs.length; i++) {
    const a = cm.get(bs[i - 1].m), z = cm.get(bs[i].m); if (!(a > 0) || !(z > 0)) continue;
    const b = bs[i].v / bs[i - 1].v - 1, c = z / a - 1; out.push({ m: bs[i].m, b, c, x: b - c });
  }
  return out;
}
/** Worst fall of the book from its own peak measured against the comparator's move over the same window: min over p <= t of (b_t/b_p)/(c_t/c_p) - 1. 0 when there is no fall. */
export function relativeDrawdown(book: MV[], comp: MV[]): number {
  const cm = get(comp), pts = book.filter((x) => x.v > 0 && cm.has(x.m)).map((x) => ({ b: x.v, c: cm.get(x.m)! }));
  let worst = 0; for (let t = 0; t < pts.length; t++) for (let p = 0; p <= t; p++) worst = Math.min(worst, (pts[t].b / pts[p].b) / (pts[t].c / pts[p].c) - 1);
  return worst;
}
/** The book's own fall from its peak, for reporting. */
export function drawdown(book: MV[]): number { let peak = 0, w = 0; for (const x of book) { if (x.v > peak) peak = x.v; if (peak > 0) w = Math.min(w, x.v / peak - 1); } return w; }
const trail6 = (book: MV[], comp: MV[], k: number): number | null => { const cm = get(comp), pts = book.filter((x) => x.v > 0 && cm.has(x.m)); if (k < 6 || k >= pts.length) return null; return (pts[k].v / pts[k - 6].v - 1) - (cm.get(pts[k].m)! / cm.get(pts[k - 6].m)! - 1); };

export interface KillLine { name: string; hit: boolean; detail: string }
export interface Kill { status: 'Continue' | 'Watch' | 'Kill'; lines: KillLine[] }
/** C-174: relative drawdown of 20%; trailing 6-month net return more than 5 points below the comparator at two consecutive reads; zero or negative average net return per closed trade after 40 trades. One line is Watch; the drawdown line alone or any two is Kill. */
export function killStatus(book: MV[], comp: MV[], trades: { n: number; avg: number | null }): Kill {
  const rd = relativeDrawdown(book, comp), pts = book.filter((x) => x.v > 0 && get(comp).has(x.m)).length;
  const a = trail6(book, comp, pts - 1), b = trail6(book, comp, pts - 2), two = a !== null && b !== null && a < -0.05 && b < -0.05;
  const lines: KillLine[] = [
    { name: 'Relative drawdown', hit: rd <= -0.2, detail: `${(rd * 100).toFixed(1)}% against the comparator (line at -20%)` },
    { name: 'Trailing 6 months', hit: two, detail: a === null ? 'fewer than 7 monthly reads' : `${(a * 100).toFixed(1)} points now${b === null ? '' : `, ${(b * 100).toFixed(1)} last month`} (line at -5 for two reads)` },
    { name: 'Average per trade', hit: trades.n >= 40 && trades.avg !== null && trades.avg <= 0, detail: trades.n < 40 ? `${trades.n} closed trades (line applies from 40)` : `${((trades.avg ?? 0) * 100).toFixed(2)}% average over ${trades.n} trades` },
  ];
  const hits = lines.filter((l) => l.hit).length;
  return { status: lines[0].hit || hits >= 2 ? 'Kill' : hits === 1 ? 'Watch' : 'Continue', lines };
}
export interface Scorecard { months: number; sinceStart: { book: number | null; comp: number | null; excess: number | null }; excessLastMonth: number | null; trailing6: number | null; drawdown: number; relDrawdown: number; confidence: Confidence; trend: number[]; kill: Kill; pairs: Pair[] }
/** Everything on one book's monthly read against its one comparator. hurdleMonthly = the book's monthly trading cost above the comparator's (decimal, never below 0). */
export function scorecard(book: MV[], comp: MV[], trades: { n: number; avg: number | null }, hurdleMonthly: number): Scorecard {
  const pairs = paired(book, comp), x = pairs.map((p) => p.x), cm = get(comp), pts = book.filter((p) => p.v > 0 && cm.has(p.m));
  const first = pts[0], last = pts.at(-1), sb = first && last && first !== last ? last.v / first.v - 1 : null, sc = first && last && first !== last ? cm.get(last.m)! / cm.get(first.m)! - 1 : null;
  const trend: number[] = []; for (let k = Math.max(1, x.length - 5); k <= x.length; k++) trend.push(confidenceOf(x.slice(0, k), hurdleMonthly).confidence);
  return { months: pairs.length, sinceStart: { book: sb, comp: sc, excess: sb !== null && sc !== null ? sb - sc : null }, excessLastMonth: x.length ? x.at(-1)! : null, trailing6: trail6(book, comp, pts.length - 1), drawdown: drawdown(book), relDrawdown: relativeDrawdown(book, comp), confidence: confidenceOf(x, hurdleMonthly), trend, kill: killStatus(book, comp, trades), pairs };
}
