// Overlap of the company-figure books (diagnosis only; no pass or kill line). A name "qualifies" in a book when it is rank 20 or better in that book's own ranking.
export interface OvBook { id: string; short: string; label: string; list: string[] }
export interface OvName { sym: string; industry: string | null; in: string[]; ranks: Record<string, number>; count: number }
export const OV_TOP = 20;
export function overlapOf(bs: OvBook[], industry: (sym: string) => string | null): { names: OvName[]; pairs: Record<string, number>; corr: Record<string, number | null>; common: Record<string, number> } {
  const by = new Map<string, OvName>();
  for (const b of bs) b.list.slice(0, OV_TOP).forEach((sym, i) => { const o = by.get(sym) ?? { sym, industry: industry(sym), in: [], ranks: {}, count: 0 }; o.in.push(b.short); o.ranks[b.short] = i + 1; o.count++; by.set(sym, o); });
  const names = [...by.values()].sort((a, b) => b.count - a.count || (a.sym < b.sym ? -1 : 1));
  const pairs: Record<string, number> = {}, corr: Record<string, number | null> = {}, common: Record<string, number> = {};
  for (let a = 0; a < bs.length; a++) for (let c = a + 1; c < bs.length; c++) {
    const key = bs[a].short + '|' + bs[c].short, A = new Set(bs[a].list.slice(0, OV_TOP));
    pairs[key] = bs[c].list.slice(0, OV_TOP).filter((x) => A.has(x)).length;
    const inC = new Set(bs[c].list), both = bs[a].list.filter((x) => inC.has(x)), n = both.length, S = new Set(both);
    const pa = new Map(bs[a].list.filter((x) => S.has(x)).map((x, i) => [x, i])), pc = new Map(bs[c].list.filter((x) => S.has(x)).map((x, i) => [x, i]));
    common[key] = n;
    corr[key] = n >= 10 ? Math.round((1 - 6 * both.reduce((q, x) => q + ((pa.get(x) as number) - (pc.get(x) as number)) ** 2, 0) / (n * (n * n - 1))) * 100) / 100 : null;
  }
  return { names, pairs, corr, common };
}
