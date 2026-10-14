// Company lineage (design 7.3 step 1): symbols and ISINs that belong to one company are joined with union-find over every (symbol, ISIN)
// pair seen in the orders and in the exchange corporate-action feed. The canonical key is the ISIN most recently seen, so a rename or a
// split-driven ISIN change does not break the lot chain.
import type { Trade } from './reader.ts';
export class Lineage {
  private p = new Map<string, string>(); private lastSeen = new Map<string, string>();
  private find(x: string): string { let r = x; while ((this.p.get(r) ?? r) !== r) r = this.p.get(r)!; this.p.set(x, r); return r; }
  private add(x: string) { if (!this.p.has(x)) this.p.set(x, x); }
  link(symbol: string | undefined, isin: string | undefined, date: string) {
    this.memo.clear();
    const ids = [symbol ? 'S:' + symbol.toUpperCase() : '', isin ? 'I:' + isin : ''].filter(Boolean);
    for (const i of ids) this.add(i);
    if (ids.length === 2) this.p.set(this.find(ids[0]), this.find(ids[1]));
    if (isin) { const prev = this.lastSeen.get('I:' + isin); if (!prev || prev < date) this.lastSeen.set('I:' + isin, date); }
  }
  /** Canonical key for a company: the ISIN of its group seen most recently; falls back to the symbol. */
  private memo = new Map<string, string>();
  key(symbol?: string, isin?: string): string {
    const mk = (isin ?? '') + '|' + (symbol ?? ''); const hit = this.memo.get(mk); if (hit !== undefined) return hit;
    const r = this.keyUncached(symbol, isin); this.memo.set(mk, r); return r;
  }
  private keyUncached(symbol?: string, isin?: string): string {
    const id = isin ? 'I:' + isin : symbol ? 'S:' + symbol.toUpperCase() : ''; if (!id || !this.p.has(id)) return isin || (symbol ?? '').toUpperCase();
    const root = this.find(id); let best = '', bd = '';
    for (const [k, d] of this.lastSeen) if (k.startsWith('I:') && this.p.has(k) && this.find(k) === root && d >= bd) { best = k.slice(2); bd = d; }
    return best || (symbol ?? '').toUpperCase();
  }
}
export function canonicalise(trades: Trade[], feedPairs: { symbol: string; isin?: string; date: string }[] = []): { trades: Trade[]; lineage: Lineage } {
  const lin = new Lineage();
  for (const t of trades) lin.link(t.symbol ?? t.instrument, t.isin, t.date);
  for (const f of feedPairs) lin.link(f.symbol, f.isin, f.date);
  return { trades: trades.map((t) => ({ ...t, isin: lin.key(t.symbol ?? t.instrument, t.isin) })), lineage: lin };
}
