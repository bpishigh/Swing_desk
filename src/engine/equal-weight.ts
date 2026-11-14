/** Equal-weight reference line for the Batch A books: the book's own universe (the top 500 by traded value) held at equal weight, rebuilt on the first session of each month, price only, no costs, no cash.
 *  It is reported beside every Batch A book so a gap to a cap-weighted comparator is not read as a failed rule. Forward only: it starts the first night the book is stepped. */
export interface EwState { month: string; navBase: number; base: Record<string, number>; nav: Record<string, number> }
export function stepEw(st: { ew?: EwState }, D: string, syms: string[], closeAt: (sym: string) => number | null): number | null {
  const mk = D.slice(0, 7); let ew = st.ew;
  const cur = (): number | null => { if (!ew) return null; let s = 0, n = 0; for (const [sym, b] of Object.entries(ew.base)) { const c = closeAt(sym); if (c != null && c > 0 && b > 0) { s += c / b; n++; } } return n >= 20 ? ew.navBase * (s / n) : null; };
  if (!ew) { const base: Record<string, number> = {}; for (const s of syms) { const c = closeAt(s); if (c != null && c > 0) base[s] = c; } ew = st.ew = { month: mk, navBase: 100, base, nav: {} }; }
  else if (ew.month !== mk) { const v = cur(); if (v != null) { const base: Record<string, number> = {}; for (const s of syms) { const c = closeAt(s); if (c != null && c > 0) base[s] = c; } ew = st.ew = { month: mk, navBase: v, base, nav: ew.nav }; } }
  const v = cur(); if (v != null) { ew.nav[D] = Math.round(v * 1e4) / 1e4; const ks = Object.keys(ew.nav); if (ks.length > 900) for (const k of ks.slice(0, ks.length - 900)) delete ew.nav[k]; }
  return v;
}
