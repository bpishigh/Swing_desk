// Fund overlap and look-through (Engine Rules C-78). Pure maths: no network, no personal data stored.
// Look-through exposure to a company = value held directly + each fund's value x that company's weight in the fund's latest published portfolio.
// A fund with no portfolio data is "not covered" and left out; nothing is estimated.
                                                                                                  // weight in percent of the fund
                                                                                        
                                                              // by fund ISIN
                                                                                                                                            
                                                                                                   // overlapFlag as a fraction (0.4), positionCap as a fraction of capital
export const DEFAULTS           = { overlapFlag: 0.4, staleDays: 75, positionCap: null };

                                                                                                                                                                                                             
                                                                                                                                     
                              
                                                                                               
                                                                                                                          
                                                                                                                         
 

// a few companies renamed: older portfolio lines and newer broker names must meet
const RENAMED                         = { 'zomato': 'eternal', 'larsen and toubro infotech': 'ltimindtree' };
const norm = (s        ) => { const n = norm0(s); return RENAMED[n] ?? n; };
export const norm0 = (s        ) => s.toLowerCase().replace(/&/g, ' and ').replace(/\b(limited|ltd|the|corporation|corp|company|co)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const days = (a        , b        ) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const inRange = (lines                 ) => { const t = lines.reduce((a, l) => a + (l.weight > 0 ? l.weight : 0), 0); return t >= 50 && t <= 105; };
export function lookThrough(positions            , ports                , today        , capital        , cfg                    = {})              {
  const s = { ...DEFAULTS, ...cfg };
  const by = new Map                  (), tag = (p                                                  ) => (p.isin ? 'I:' + p.isin : p.symbol ? 'S:' + p.symbol : 'N:' + norm(p.name));
  // direct stocks give the ISIN/symbol/name indexes that fund lines are matched to
  const idx = { isin: new Map                (), sym: new Map                (), name: new Map                () };
  const get = (k        , name        ) => { let e = by.get(k); if (!e) by.set(k, (e = { key: k, name, direct: 0, viaFunds: 0, total: 0, pctCapital: 0, pctEquity: 0, sources: [], overCap: false })); return e; };
  for (const p of positions) if (p.kind === 'Stock' && p.value > 0) { const k = tag(p); get(k, p.name).direct += p.value; if (p.isin) idx.isin.set(p.isin, k); if (p.symbol) idx.sym.set(p.symbol.toUpperCase(), k); idx.name.set(norm(p.name), k); }
  // a fund line that has only a name must meet the same company when another fund's line has its symbol or ISIN: names seen next to a symbol or ISIN anywhere are indexed first
  for (const port of Object.values(ports)) for (const l of port.lines) { const k = l.symbol ? 'S:' + l.symbol.toUpperCase() : l.isin ? 'I:' + l.isin : null; if (k && l.weight > 0 && !idx.name.has(norm(l.name))) idx.name.set(norm(l.name), (l.isin && idx.isin.get(l.isin)) || (l.symbol && idx.sym.get(l.symbol.toUpperCase())) || k); }
  const funds = positions.filter((p) => (p.kind === 'Fund' || p.kind === 'ETF') && p.value > 0), notCovered           = [], stale                       = [], unmatchedWeight                         = {};
  let covered = 0, fundValue = 0, wFunds = new Map                                                  ();
  for (const f of funds) {
    fundValue += f.value; const port = f.fundIsin ? ports[f.fundIsin] : undefined;
    // weights adding to well over 100% (derivative exposure in arbitrage and similar funds) cannot be read as shares of the money; a portfolio with under half its money in equity lines (mostly debt, REITs or fund units) would show a small slice as if it were the whole: both are not covered
    if (!port || !port.lines.length || !inRange(port.lines)) { notCovered.push(f.name); continue; }
    covered += f.value * Math.min(1, port.lines.reduce((t, l) => t + (l.weight > 0 ? l.weight : 0), 0) / 100); const d = days(port.asOf, today); if (d > s.staleDays) stale.push({ fund: f.name, asOf: port.asOf, days: d });
    const m = new Map                                     (); let unmatched = 0;
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
  const overlaps            = [], names = [...wFunds.keys()];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const A = wFunds.get(names[i]) , B = wFunds.get(names[j]) ; let sum = 0; const shared                    = [];
    for (const [k, a] of A) { const b = B.get(k); if (b) { sum += Math.min(a.w, b.w); shared.push({ name: a.name, wa: a.w, wb: b.w }); } }
    if (shared.length) overlaps.push({ a: names[i], b: names[j], overlap: sum / 100, shared: shared.sort((x, y) => Math.min(y.wa, y.wb) - Math.min(x.wa, x.wb)), flag: sum / 100 >= s.overlapFlag });
  }
  overlaps.sort((x, y) => y.overlap - x.overlap);
  return { capital, equity, covered, fundValue, coverage: fundValue > 0 ? covered / fundValue : null, exposures, overlaps, notCovered, stale, unmatchedWeight };
}

/** A scheme's name without plan and option words, so a Regular and a Direct plan of the same scheme share one key. */
export function schemeBase(name        )         {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/\b(direct|regular|plan|option|growth|idcw|dividend|payout|reinvestment|bonus)\b/g, ' ').replace(/\bfof\b/g, 'fund of funds').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
