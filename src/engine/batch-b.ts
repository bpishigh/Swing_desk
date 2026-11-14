// Batch B signal rules (docs/BATCH_B_RULES.md). B1 Magic Formula is the first adopted block (C-205). Pure: data in, orders out. Shares the Batch A universe (top 500), review, stay rule and stops.
import { BA, reviewNow, rebalance, orNull, byValue, type BCtx } from './batch-a.ts';
import type { Name, Orders } from './first-wave.ts';

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
export { BA };
