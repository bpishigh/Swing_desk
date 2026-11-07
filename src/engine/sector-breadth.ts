// C-153: sector (industry-group) breadth. Logic-based, not backtested: a group in which most stocks are below their 50-day is a poor place to look for
// rising stocks. Information and a paper-book slice only; it blocks nothing. Same 40% line as the market-breadth cap in the traffic light.
export const WEAK_BREADTH = 40;   // percent of a group's stocks above their 50-day
export const MIN_GROUP = 8;       // fewer stocks than this and the share is too noisy to show
export interface BreadthItem { group: string | null; above: boolean | null }   // above: null when the stock has no 50-day average yet
export interface GroupBreadth { pct: number; n: number }

/** Share of each group's stocks (with a 50-day average) closing above it. Groups under MIN_GROUP stocks are left out. */
export function groupBreadth(items: BreadthItem[]): Map<string, GroupBreadth> {
  const acc = new Map<string, { up: number; n: number }>();
  for (const it of items) {
    if (!it.group || it.above === null) continue;
    const a = acc.get(it.group) ?? acc.set(it.group, { up: 0, n: 0 }).get(it.group)!;
    a.n++; if (it.above) a.up++;
  }
  const out = new Map<string, GroupBreadth>();
  for (const [g, a] of acc) if (a.n >= MIN_GROUP) out.set(g, { pct: Math.round((1000 * a.up) / a.n) / 10, n: a.n });
  return out;
}
export const isWeakSector = (gb: GroupBreadth | null | undefined): boolean => !!gb && gb.pct < WEAK_BREADTH;
