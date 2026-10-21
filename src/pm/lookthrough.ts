// Fund overlap and look-through (Engine Rules C-78). Pure maths: no network, no personal data stored.
// Look-through exposure to a company = value held directly + each fund's value x that company's weight in the fund's latest published portfolio.
// A fund with no portfolio data is "not covered" and left out; nothing is estimated.
export interface PortfolioLine { name: string; isin?: string; symbol?: string; weight: number }   // weight in percent of the fund
export interface FundPortfolio { asOf: string; source?: string; lines: PortfolioLine[] }
export type FundPortfolios = Record<string, FundPortfolio>;   // by fund ISIN
export interface Position { name: string; kind: 'Stock' | 'ETF' | 'Fund'; value: number; isin?: string; symbol?: string; fundIsin?: string }
export interface Settings { overlapFlag: number; staleDays: number; positionCap: number | null }   // overlapFlag as a fraction (0.4), positionCap as a fraction of capital
export const DEFAULTS: Settings = { overlapFlag: 0.4, staleDays: 75, positionCap: null };

export interface Exposure { key: string; name: string; direct: number; viaFunds: number; total: number; pctCapital: number; pctEquity: number; sources: { fund: string; value: number }[]; overCap: boolean }
export interface Overlap { a: string; b: string; overlap: number; shared: { name: string; wa: number; wb: number }[]; flag: boolean }
export interface LookThrough {
  capital: number; equity: number; covered: number; fundValue: number; coverage: number | null;
  exposures: Exposure[]; overlaps: Overlap[]; notCovered: string[]; stale: { fund: string; asOf: string; days: number }[];
  unmatchedWeight: Record<string, number>;   // fund -> percent of its portfolio that could not be tied to a listed stock
}

// a few companies renamed: older portfolio lines and newer broker names must meet
const RENAMED: Record<string, string> = { 'zomato': 'eternal', 'larsen and toubro infotech': 'ltimindtree' };
const norm = (s: string) => { const n = norm0(s); return RENAMED[n] ?? n; };
const norm0 = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/\b(limited|ltd|the|corporation|corp|company|co)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const inRange = (lines: PortfolioLine[]) => { const t = lines.reduce((a, l) => a + (l.weight > 0 ? l.weight : 0), 0); return t >= 50 && t <= 105; };
export function lookThrough(positions: Position[], ports: FundPortfolios, today: string, capital: number, cfg: Partial<Settings> = {}): LookThrough {
  const s = { ...DEFAULTS, ...cfg };
  const by = new Map<string, Exposure>(), tag = (p: { isin?: string; symbol?: string; name: string }) => (p.isin ? 'I:' + p.isin : p.symbol ? 'S:' + p.symbol : 'N:' + norm(p.name));
  // direct stocks give the ISIN/symbol/name indexes that fund lines are matched to
  const idx = { isin: new Map<string, string>(), sym: new Map<string, string>(), name: new Map<string, string>() };
  const get = (k: string, name: string) => { let e = by.get(k); if (!e) by.set(k, (e = { key: k, name, direct: 0, viaFunds: 0, total: 0, pctCapital: 0, pctEquity: 0, sources: [], overCap: false })); return e; };
  for (const p of positions) if (p.kind === 'Stock' && p.value > 0) { const k = tag(p); get(k, p.name).direct += p.value; if (p.isin) idx.isin.set(p.isin, k); if (p.symbol) idx.sym.set(p.symbol.toUpperCase(), k); idx.name.set(norm(p.name), k); }
  const funds = positions.filter((p) => (p.kind === 'Fund' || p.kind === 'ETF') && p.value > 0), notCovered: string[] = [], stale: LookThrough['stale'] = [], unmatchedWeight: Record<string, number> = {};
  let covered = 0, fundValue = 0, wFunds = new Map<string, Map<string, { name: string; w: number }>>();
  for (const f of funds) {
    fundValue += f.value; const port = f.fundIsin ? ports[f.fundIsin] : undefined;
    // weights adding to well over 100% (derivative exposure in arbitrage and similar funds) cannot be read as shares of the money; a portfolio with under half its money in equity lines (mostly debt, REITs or fund units) would show a small slice as if it were the whole: both are not covered
    if (!port || !port.lines.length || !inRange(port.lines)) { notCovered.push(f.name); continue; }
    covered += f.value; const d = days(port.asOf, today); if (d > s.staleDays) stale.push({ fund: f.name, asOf: port.asOf, days: d });
    const m = new Map<string, { name: string; w: number }>(); let unmatched = 0;
    for (const l of port.lines) {
      if (!(l.weight > 0)) continue;
      const k = (l.isin && idx.isin.get(l.isin)) || (l.symbol && idx.sym.get(l.symbol.toUpperCase())) || idx.name.get(norm(l.name)) || (l.isin ? 'I:' + l.isin : l.symbol ? 'S:' + l.symbol.toUpperCase() : 'N:' + norm(l.name));
      if (!(l.isin && idx.isin.get(l.isin)) && !(l.symbol && idx.sym.get(l.symbol.toUpperCase())) && !idx.name.get(norm(l.name))) unmatched += l.weight;
      const e = get(k, l.name), v = f.value * l.weight / 100; e.viaFunds += v; e.sources.push({ fund: f.name, value: v });
      const o = m.get(k); if (o) o.w += l.weight; else m.set(k, { name: l.name, w: l.weight });
    }
    unmatchedWeight[f.name] = Math.round(unmatched * 100) / 100; wFunds.set(f.name, m);
  }
  const equity = positions.filter((p) => p.kind === 'Stock').reduce((t, p) => t + p.value, 0) + funds.reduce((t, f) => t + f.value, 0);
  const exposures = [...by.values()].map((e) => ({ ...e, total: e.direct + e.viaFunds, pctCapital: capital > 0 ? (e.direct + e.viaFunds) / capital : 0, pctEquity: equity > 0 ? (e.direct + e.viaFunds) / equity : 0, overCap: s.positionCap !== null && capital > 0 && (e.direct + e.viaFunds) / capital > s.positionCap })).sort((a, b) => b.total - a.total);
  const overlaps: Overlap[] = [], names = [...wFunds.keys()];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const A = wFunds.get(names[i])!, B = wFunds.get(names[j])!; let sum = 0; const shared: Overlap['shared'] = [];
    for (const [k, a] of A) { const b = B.get(k); if (b) { sum += Math.min(a.w, b.w); shared.push({ name: a.name, wa: a.w, wb: b.w }); } }
    if (shared.length) overlaps.push({ a: names[i], b: names[j], overlap: sum / 100, shared: shared.sort((x, y) => Math.min(y.wa, y.wb) - Math.min(x.wa, x.wb)), flag: sum / 100 >= s.overlapFlag });
  }
  overlaps.sort((x, y) => y.overlap - x.overlap);
  return { capital, equity, covered, fundValue, coverage: fundValue > 0 ? covered / fundValue : null, exposures, overlaps, notCovered, stale, unmatchedWeight };
}

/** A scheme's name without plan and option words, so a Regular and a Direct plan of the same scheme share one key. */
export function schemeBase(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/\b(direct|regular|plan|option|growth|idcw|dividend|payout|reinvestment|bonus)\b/g, ' ').replace(/\bfof\b/g, 'fund of funds').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
