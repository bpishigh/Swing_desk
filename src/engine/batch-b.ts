// Batch B signal rules (docs/BATCH_B_RULES.md). B1 Magic Formula is the first adopted block (C-205). Pure: data in, orders out. Shares the Batch A universe (top 500), review, stay rule and stops.
import { BA, reviewNow, rebalance, orNull, byValue, pct, qualityRanked, type BCtx } from './batch-a.ts';
import type { Name, Orders } from './first-wave.ts';
import type { Features } from './fundamentals-asof.ts';

export const LIQUID_BASIS = 'cash+bank+current investments';

/** B1 Magic Formula (Greenblatt). Eligible: non-financial, not in the Power industry (utilities), latest balance sheet read with the liquid-investment lines, operating EBIT and enterprise value both positive, a return on capital.
 *  Earnings yield = TTM operating EBIT / enterprise value (market cap + borrowings - cash, bank deposits and current investments). Return on capital as built in A0 (working capital floored at zero).
 *  Rank 1 = highest on each; combined rank = the sum; lowest first, ties to higher traded value. */
export function magicRanked(x: BCtx): Array<Name & { s: number; ey: number; roc: number }> {
  const rows: Array<Name & { ey: number; roc: number }> = [];
  for (const n of x.el) {
    const f = x.fund[n.sym]; if (!f || f.financial) continue;
    if ((x.group?.(n.sym) ?? null) === 'Power') continue;
    if (f.bs?.liquidBasis !== LIQUID_BASIS) continue;
    const ebit = f.ttm.operatingEbit, ev = f.enterpriseValue, roc = f.returnOnCapital;
    if (ebit == null || !(ebit > 0) || ev == null || !(ev > 0) || roc == null || !(roc > 0)) continue;
    rows.push({ ...n, ey: ebit / ev, roc });
  }
  const rank = (k: 'ey' | 'roc'): Map<string, number> => { const o = [...rows].sort((a, b) => b[k] - a[k] || byValue(a, b)); return new Map(o.map((r, i) => [r.sym, i + 1])); };
  const re = rank('ey'), rr = rank('roc');
  const out = rows.map((r) => ({ ...r, s: (re.get(r.sym) as number) + (rr.get(r.sym) as number) }));
  out.sort((a, b) => a.s - b.s || b.value - a.value || byValue(a, b)); return out;
}
export function magic(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(rebalance(magicRanked(x), x)); }

/** B2 Piotroski F-score, fiscal-year basis (C-206). Pool: non-financial names with positive year-end equity and a market cap; the highest 30% by book-to-market (year-end equity / market cap).
 *  Nine tests of 1 point each on the latest fiscal year against the one before; a name missing any figure is not scored. Paper rule: hold the names scoring 8 or 9 (at most 20), highest score then highest book-to-market. No floor of 7 (owner, 14 Nov 2026). */
export const PIO = { cheapShare: 0.3, minScore: 8 };
export function piotroskiScore(f: Features): { f: number; tests: boolean[] } | null {
  const y = f.fy; if (!y || f.financial) return null; const c = y.cur, p = y.prev;
  const need = [c.assets, p.assets, c.pat, p.pat, c.cfo, c.borrowings, p.borrowings, c.currentAssets, c.currentLiabilities, p.currentAssets, p.currentLiabilities, c.ebit, p.ebit, c.revenue, p.revenue];
  if (need.some((v) => v == null) || !(c.assets as number > 0) || !(p.assets as number > 0) || !(c.revenue as number > 0) || !(p.revenue as number > 0) || !(c.currentLiabilities as number > 0) || !(p.currentLiabilities as number > 0) || y.shareRatio == null) return null;
  const roa = (c.pat as number) / (c.assets as number), roaP = (p.pat as number) / (p.assets as number);
  const tests = [roa > 0, (c.cfo as number) > 0, roa > roaP, (c.cfo as number) > (c.pat as number),
    (c.borrowings as number) / (c.assets as number) < (p.borrowings as number) / (p.assets as number),
    (c.currentAssets as number) / (c.currentLiabilities as number) > (p.currentAssets as number) / (p.currentLiabilities as number),
    y.shareRatio <= 1.02,
    (c.ebit as number) / (c.revenue as number) > (p.ebit as number) / (p.revenue as number),
    (c.revenue as number) / (c.assets as number) > (p.revenue as number) / (p.assets as number)];
  return { f: tests.filter(Boolean).length, tests };
}
/** The cheap pool and everyone in it who can be scored, best first (score, then book-to-market). */
export function piotroskiPool(x: BCtx): { pool: number; scored: Array<Name & { s: number; bm: number }> } {
  const rows: Array<Name & { bm: number }> = [];
  for (const n of x.el) { const f = x.fund[n.sym]; if (!f || f.financial || !f.fy || f.marketCap == null || !(f.marketCap > 0) || f.fy.cur.equity == null || !(f.fy.cur.equity > 0)) continue; rows.push({ ...n, bm: f.fy.cur.equity / f.marketCap }); }
  rows.sort((a, b) => b.bm - a.bm || byValue(a, b));
  const cheap = rows.slice(0, Math.ceil(rows.length * PIO.cheapShare)), scored: Array<Name & { s: number; bm: number }> = [];
  for (const r of cheap) { const sc = piotroskiScore(x.fund[r.sym]); if (sc) scored.push({ ...r, s: sc.f }); }
  scored.sort((a, b) => b.s - a.s || b.bm - a.bm || byValue(a, b));
  return { pool: cheap.length, scored };
}
export const piotroskiRanked = (x: BCtx): Array<Name & { s: number; bm: number }> => piotroskiPool(x).scored.filter((r) => r.s >= PIO.minScore);
export function piotroski(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(rebalance(piotroskiRanked(x), x)); }

/** B3 Full quality (C-207): A3 with three changes. Keeps margin (within industry when the industry has 5 or more scored names), stability over 12 quarters and 3-year revenue CAGR as A3 scores them; replaces interest cover with net debt over operating EBIT
 *  (net cash counts as zero, the best; EBIT not positive means not scored); adds return on capital and cash quality (latest fiscal-year operating cash flow over total assets). Six measures, equal-weighted percentile ranks, all required. Needs the liquid-investment balance sheet.
 *  `parts` order: margin, stability, growth, net debt/EBIT, return on capital, cash quality. */
export function fullQualityRanked(x: BCtx): Array<Name & { s: number; parts: number[] }> {
  const a3 = new Map(qualityRanked(x).map((r) => [r.sym, r.parts])), rows: Array<Name & { a: number[]; lev: number; roc: number; cq: number }> = [];
  for (const n of x.el) {
    const f = x.fund[n.sym], p = a3.get(n.sym); if (!f || !p || f.financial || f.bs?.liquidBasis !== LIQUID_BASIS) continue;
    const ebit = f.ttm.operatingEbit, cfo = f.cashFlowFy[0]?.cfo, assets = f.bs?.assets;
    if (ebit == null || !(ebit > 0) || f.netDebt == null || f.returnOnCapital == null || cfo == null || assets == null || !(assets > 0)) continue;
    rows.push({ ...n, a: p, lev: Math.max(0, f.netDebt / ebit), roc: f.returnOnCapital, cq: cfo / assets });
  }
  const col = (k: 'lev' | 'roc' | 'cq') => rows.map((r) => r[k]);
  const out = rows.map((r) => { const parts = [r.a[0], r.a[1], r.a[3], 1 - pct(col('lev'), r.lev), pct(col('roc'), r.roc), pct(col('cq'), r.cq)]; return { sym: r.sym, value: r.value, s: parts.reduce((u, v) => u + v, 0) / 6, parts }; });
  out.sort((a, b) => b.s - a.s || byValue(a, b)); return out;
}
export function fullQuality(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(rebalance(fullQualityRanked(x), x)); }
export { BA };
