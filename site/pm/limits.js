// Household limits and goals (scope item 9). Facts and flags only: nothing here sells, buys or changes a verdict or a score.
// Limits: one company, one sector (as a share of household equity, funds opened up) and one fund house (as a share of fund money).
// Goals: a named amount needed by a date, funded by holdings the owner assigns to it.
import { norm0,               } from './lookthrough.js';

                                                                                    // fractions, e.g. 0.10
export const LIMIT_DEFAULTS                = { company: 0.10, sector: 0.30, house: 0.35 };

                                                                                                                                               

/** Sector of each company: by symbol when known, else by the company's normalised name. */
                                                                                              
export function buildSectorIndex(industry                        , names                        )              {
  const byName                         = {};
  for (const [sym, name] of Object.entries(names)) { const s = industry[sym]; if (s) byName[norm0(name)] = s; }
  return { bySym: industry, byName };
}
export function sectorOf(e                               , ix             )         {
  if (e.key.startsWith('S:')) { const s = ix.bySym[e.key.slice(2)]; if (s) return s; }
  return ix.byName[norm0(e.name)] ?? 'Not classified';
}

const AMCS = ['aditya birla sun life', 'axis', 'bajaj finserv', 'bandhan', 'bank of india', 'baroda bnp paribas', 'canara robeco', 'dsp', 'edelweiss', 'franklin', 'groww', 'hdfc', 'helios', 'hsbc', 'icici prudential', 'invesco', 'iti', 'jm financial', 'kotak', 'lic', 'mahindra manulife', 'mirae asset', 'motilal oswal', 'navi', 'nippon india', 'old bridge', 'parag parikh', 'pgim india', 'quant', 'quantum', 'samco', 'sbi', 'shriram', 'sundaram', 'tata', 'taurus', 'trust', 'union', 'uti', 'whiteoak', 'zerodha', '360 one'];
const AMC_SORTED = [...AMCS].sort((a, b) => b.length - a.length);
/** The fund house from a scheme name: the longest known house name it starts with, else its first word. */
export function fundHouse(name        )         {
  const n = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const a of AMC_SORTED) if (n === a || n.startsWith(a + ' ')) return a === '360 one' ? '360 ONE' : a.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^(Dsp|Sbi|Lic|Uti|Iti|Hdfc|Hsbc)$/, (m) => m.toUpperCase());
  const w = n.split(' ')[0] ?? ''; return w ? w[0].toUpperCase() + w.slice(1) : 'Unknown';
}

/** Rows over, or close to, their limit. `equity` is the household's equity base for company and sector shares (look-through); `funds` are the held funds and ETFs with their values. */
export function checkLimits(exposures            , equity        , funds                                   , ix             , s                = LIMIT_DEFAULTS)                                                                                                 {
  const company             = [], bySector = new Map                (), house = new Map                ();
  let classified = 0, all = 0;
  for (const e of exposures) {
    if (equity > 0) company.push({ kind: 'Company', name: e.name, value: e.total, pct: e.total / equity, limit: s.company, over: e.total / equity > s.company });
    const sec = sectorOf(e, ix); bySector.set(sec, (bySector.get(sec) ?? 0) + e.total); all += e.total; if (sec !== 'Not classified') classified += e.total;
  }
  const sector             = equity > 0 ? [...bySector].filter(([k]) => k !== 'Not classified').map(([k, v]) => ({ kind: 'Sector'         , name: k, value: v, pct: v / equity, limit: s.sector, over: v / equity > s.sector })) : [];
  const fundTotal = funds.reduce((t, f) => t + f.value, 0);
  for (const f of funds) house.set(fundHouse(f.name), (house.get(fundHouse(f.name)) ?? 0) + f.value);
  const houseRows             = fundTotal > 0 ? [...house].map(([k, v]) => ({ kind: 'Fund house'         , name: k, value: v, pct: v / fundTotal, limit: s.house, over: v / fundTotal > s.house })) : [];
  const sort = (a            ) => a.sort((x, y) => y.pct - x.pct);
  return { company: sort(company), sector: sort(sector), house: sort(houseRows), classifiedShare: all > 0 ? classified / all : null };
}

                                                                                                        // holdings: optional hand-picked list; without it the money is assigned by assignGoals
                                                                                                               // riskClass: equity, sector, international or similar that can fall hard
                                                                                                                                                                                  
export const GOAL_SOON_MONTHS = 36, GOAL_RISK_SHARE = 0.3;

export function goalStatus(g      , held               , today        )             {
  const by = new Map(held.map((h) => [h.name, h])), names = g.holdings ?? held.map((h) => h.name), parts = names.map((n) => by.get(n)).filter((x)                   => !!x);
  const missing = names.filter((n) => !by.has(n));
  const funded = parts.reduce((t, h) => t + h.value, 0), risky = parts.filter((h) => h.riskClass).reduce((t, h) => t + h.value, 0);
  const months = Math.round((Date.parse(g.date) - Date.parse(today)) / (30.4375 * 86400000)), shortfall = Math.max(0, g.amount - funded);
  const riskShare = funded > 0 ? risky / funded : 0;
  const warn = months <= 0 ? (shortfall > 0 ? 'The date has passed and the goal is not fully funded.' : null)
    : months <= GOAL_SOON_MONTHS && riskShare > GOAL_RISK_SHARE ? `${Math.round(riskShare * 100)}% of this goal's money is in equity-type holdings and it is needed within ${months} months: a fall just before the date would hit it directly.` : null;
  return { funded, pct: g.amount > 0 ? funded / g.amount : 0, months, shortfall, perMonth: months > 0 && shortfall > 0 ? shortfall / months : null, riskShare, warn, missing };
}

/** How much a holding can fall: 0 cash-like, 1 debt, 2 gold, silver and hybrid, 3 index and international, 4 active equity funds, 5 direct stocks and sector funds. Null when the class is unknown (left out). */
export function riskTier(cls                           )                {
  switch (cls) { case 'liquid': return 0; case 'debt': return 1; case 'gold': case 'silver': case 'hybrid': return 2; case 'index': case 'international': return 3; case 'active_equity_fund': return 4; case 'direct_equity': case 'sector_thematic': return 5; default: return null; }
}
/** The riskiest tier a goal may use, by months left: up to 3 years debt and cash only, up to 7 years nothing above index funds, beyond that anything. */
export const maxTier = (months        )         => (months <= GOAL_SOON_MONTHS ? 1 : months <= 84 ? 3 : 5);

                                                              
/** Assigns held money to goals without the owner picking holdings. Goals are served nearest date first. A goal only takes holdings no riskier than its horizon allows; near and middle goals take the safest first, far goals take the riskiest allowed first (growth money), so the safe money stays for the near goals. A holding can be split across goals. Goals with hand-picked holdings are left as picked. */
export function assignGoals(goals        , held                                                              , today        )                                                                 {
  const pool = held.map((h) => ({ ...h, left: h.value, tier: riskTier(h.assetClass) })), picked = new Set(goals.flatMap((g) => g.holdings ?? []));
  const out             = [];
  const ordered = [...goals].sort((a, b) => a.date.localeCompare(b.date));
  for (const g of ordered) {
    if (g.holdings?.length) { out.push({ goal: g, parts: g.holdings.map((n) => held.find((h) => h.name === n)).filter((h)                             => !!h).map((h) => ({ name: h.name, value: h.value, riskClass: (riskTier(h.assetClass) ?? 0) >= 3 })) }); continue; }
    const months = Math.round((Date.parse(g.date) - Date.parse(today)) / (30.4375 * 86400000)), cap = months <= 0 ? 1 : maxTier(months);
    const far = months > 84, parts                = []; let need = g.amount;
    const cands = pool.filter((h) => h.tier !== null && h.tier <= cap && h.left > 0 && !picked.has(h.name)).sort((a, b) => (far ? b.tier  - a.tier  : a.tier  - b.tier ) || b.left - a.left);
    for (const h of cands) { if (need <= 0) break; const take = Math.min(h.left, need); h.left -= take; need -= take; parts.push({ name: h.name, value: take, riskClass: h.tier  >= 3 }); }
    out.push({ goal: g, parts });
  }
  const order = new Map(goals.map((g, i) => [g.id, i]));
  out.sort((a, b) => order.get(a.goal.id)  - order.get(b.goal.id) );
  return { assigned: out, unassigned: pool.filter((h) => h.tier !== null && !picked.has(h.name)).reduce((t, h) => t + h.left, 0), unplaced: pool.filter((h) => h.tier === null).reduce((t, h) => t + h.left, 0) };
}
