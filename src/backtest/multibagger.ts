// C-170 / C-171 multibagger studies (pre-registered in docs/replay/C170-C171-PREREG.md). Pure: closes in, counts out.
export const MB = { minPrior: 252, minPrice: 10, minDv: 1e6, near: 0.9, maxFrac: 0.1, maxWin: 21, jump: 2, bootYears: 4000, bootStocks: 2000, seed: 20261112, effectShare: 0.6,
  priceEdges: [50, 200, 1000], liqEdges: [1e7, 5e7, 25e7] };   // Rs; liquidity edges are Rs 1 crore, 5 crore, 25 crore
export const bandOf = (x: number, edges: number[]): number => { let b = 0; while (b < edges.length && x >= edges[b]) b++; return b; };
export interface Fwd { peak: number; last: number; jumped: boolean; n: number }
/** Highest close over the window divided by the start close, over the closes from i0 to iEnd (inclusive); stops at the last valid close. jumped: any one-day change between valid closes of jump times or more, or 1/jump or less. */
export function forward(c: ArrayLike<number>, i0: number, iEnd: number): Fwd | null {
  const c0 = c[i0]; if (!(c0 > 0)) return null; let peak = 1, prev = c0, last = 1, jumped = false, n = 0;
  for (let i = i0 + 1; i <= iEnd && i < c.length; i++) { const x = c[i]; if (!(x > 0)) continue; const r = x / prev; if (r >= MB.jump || r <= 1 / MB.jump) jumped = true; prev = x; last = x / c0; if (last > peak) peak = last; n++; }
  return { peak, last, jumped, n };
}
export function nearHigh(c: ArrayLike<number>, t: number, w = 252): number | null { if (t - w + 1 < 0 || !(c[t] > 0)) return null; let m = 0; for (let i = t - w + 1; i <= t; i++) if (c[i] > m) m = c[i]; return m > 0 ? c[t] / m : null; }
export function maxDaily(c: ArrayLike<number>, t: number, w = MB.maxWin): number { let m = NaN; for (let i = Math.max(1, t - w + 1); i <= t; i++) if (c[i] > 0 && c[i - 1] > 0) { const r = c[i] / c[i - 1] - 1; if (!(r <= m)) m = r; } return m; }
export const rng = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
export interface Row { sym: string; y: number; m: string; hit3: boolean; hit5: boolean; price: number; dv: number; near: boolean; priceBand: number; liqBand: number }
const rate = (rows: Row[], k: 'hit3' | 'hit5'): number => (rows.length ? rows.filter((r) => r[k]).length / rows.length : NaN);
const q = (a: number[], p: number): number => { const b = a.filter((x) => x === x).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
/** Base rates with a 90% interval from resampling start years. */
export function baseRate(rows: Row[], k: 'hit3' | 'hit5', rnd: () => number, reps = MB.bootYears): { n: number; rate: number; lo: number; hi: number } {
  const ys = [...new Set(rows.map((r) => r.y))], by = new Map(ys.map((y) => [y, rows.filter((r) => r.y === y)])), out: number[] = [];
  for (let b = 0; b < reps; b++) { let h = 0, n = 0; for (let i = 0; i < ys.length; i++) { const g = by.get(ys[Math.floor(rnd() * ys.length)])!; for (const r of g) { if (r[k]) h++; n++; } } out.push(n ? h / n : NaN); }
  return { n: rows.length, rate: rate(rows, k), lo: q(out, 0.05), hi: q(out, 0.95) };
}
/** Lift of a feature on 5x: feature hit rate over the hit rate of all rows; pooled interval by resampling years, per-year interval by resampling stocks inside each year. */
export function lift(rows: Row[], feat: (r: Row) => boolean, rnd: () => number): { n: number; featRate: number; baseRate: number; lift: number; lo: number; hi: number; years: number; passYears: number; share: number; perYear: Array<{ y: number; n: number; lift: number | null; lo: number | null }> } {
  const f = rows.filter(feat), L = (a: Row[], b: Row[]): number => { const bb = rate(b, 'hit5'), ff = rate(a, 'hit5'); return bb > 0 && a.length ? ff / bb : NaN; };
  const ys = [...new Set(rows.map((r) => r.y))].sort(), byY = new Map(ys.map((y) => [y, rows.filter((r) => r.y === y)])), out: number[] = [];
  for (let b = 0; b < MB.bootYears; b++) { let fh = 0, fn = 0, ah = 0, an = 0; for (let i = 0; i < ys.length; i++) for (const r of byY.get(ys[Math.floor(rnd() * ys.length)])!) { an++; if (r.hit5) ah++; if (feat(r)) { fn++; if (r.hit5) fh++; } } out.push(fn && ah ? (fh / fn) / (ah / an) : NaN); }
  const perYear: Array<{ y: number; n: number; lift: number | null; lo: number | null }> = []; let pass = 0;
  for (const y of ys) {
    const all = byY.get(y)!, fy = all.filter(feat), v = L(fy, all), bySym = new Map<string, Row[]>(); for (const r of all) (bySym.get(r.sym) ?? bySym.set(r.sym, []).get(r.sym)!).push(r);
    const syms = [...bySym.keys()], bs: number[] = [];
    if (fy.length && all.some((r) => r.hit5)) for (let b = 0; b < MB.bootStocks; b++) { let fh = 0, fn = 0, ah = 0, an = 0; for (let i = 0; i < syms.length; i++) for (const r of bySym.get(syms[Math.floor(rnd() * syms.length)])!) { an++; if (r.hit5) ah++; if (feat(r)) { fn++; if (r.hit5) fh++; } } bs.push(fn && ah ? (fh / fn) / (ah / an) : NaN); }
    const lo = bs.length ? q(bs, 0.05) : NaN; if (lo > 1) pass++; perYear.push({ y, n: fy.length, lift: v === v ? v : null, lo: lo === lo ? lo : null });
  }
  return { n: f.length, featRate: rate(f, 'hit5'), baseRate: rate(rows, 'hit5'), lift: L(f, rows), lo: q(out, 0.05), hi: q(out, 0.95), years: ys.length, passYears: pass, share: ys.length ? pass / ys.length : 0, perYear };
}
