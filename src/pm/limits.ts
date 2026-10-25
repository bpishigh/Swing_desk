// Household limits and goals (scope item 9). Facts and flags only: nothing here sells, buys or changes a verdict or a score.
// Limits: one company, one sector (as a share of household equity, funds opened up) and one fund house (as a share of fund money).
// Goals: a named amount needed by a date, funded by holdings the owner assigns to it.
import { norm0, type Exposure } from './lookthrough.ts';

export interface LimitSettings { company: number; sector: number; house: number }   // fractions, e.g. 0.10
export const LIMIT_DEFAULTS: LimitSettings = { company: 0.10, sector: 0.30, house: 0.35 };

export interface LimitRow { kind: 'Company' | 'Sector' | 'Fund house'; name: string; value: number; pct: number; limit: number; over: boolean }

/** Sector of each company: by symbol when known, else by the company's normalised name. */
export interface SectorIndex { bySym: Record<string, string>; byName: Record<string, string> }
export function buildSectorIndex(industry: Record<string, string>, names: Record<string, string>): SectorIndex {
  const byName: Record<string, string> = {};
  for (const [sym, name] of Object.entries(names)) { const s = industry[sym]; if (s) byName[norm0(name)] = s; }
  return { bySym: industry, byName };
}
export function sectorOf(e: { key: string; name: string }, ix: SectorIndex): string {
  if (e.key.startsWith('S:')) { const s = ix.bySym[e.key.slice(2)]; if (s) return s; }
  return ix.byName[norm0(e.name)] ?? 'Not classified';
}

const AMCS = ['aditya birla sun life', 'axis', 'bajaj finserv', 'bandhan', 'bank of india', 'baroda bnp paribas', 'canara robeco', 'dsp', 'edelweiss', 'franklin', 'groww', 'hdfc', 'helios', 'hsbc', 'icici prudential', 'invesco', 'iti', 'jm financial', 'kotak', 'lic', 'mahindra manulife', 'mirae asset', 'motilal oswal', 'navi', 'nippon india', 'old bridge', 'parag parikh', 'pgim india', 'quant', 'quantum', 'samco', 'sbi', 'shriram', 'sundaram', 'tata', 'taurus', 'trust', 'union', 'uti', 'whiteoak', 'zerodha', '360 one'];
const AMC_SORTED = [...AMCS].sort((a, b) => b.length - a.length);
/** The fund house from a scheme name: the longest known house name it starts with, else its first word. */
export function fundHouse(name: string): string {
  const n = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const a of AMC_SORTED) if (n === a || n.startsWith(a + ' ')) return a === '360 one' ? '360 ONE' : a.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^(Dsp|Sbi|Lic|Uti|Iti|Hdfc|Hsbc)$/, (m) => m.toUpperCase());
  const w = n.split(' ')[0] ?? ''; return w ? w[0].toUpperCase() + w.slice(1) : 'Unknown';
}

/** Rows over, or close to, their limit. `equity` is the household's equity base for company and sector shares (look-through); `funds` are the held funds and ETFs with their values. */
export function checkLimits(exposures: Exposure[], equity: number, funds: { name: string; value: number }[], ix: SectorIndex, s: LimitSettings = LIMIT_DEFAULTS): { company: LimitRow[]; sector: LimitRow[]; house: LimitRow[]; classifiedShare: number | null } {
  const company: LimitRow[] = [], bySector = new Map<string, number>(), house = new Map<string, number>();
  let classified = 0, all = 0;
  for (const e of exposures) {
    if (equity > 0) company.push({ kind: 'Company', name: e.name, value: e.total, pct: e.total / equity, limit: s.company, over: e.total / equity > s.company });
    const sec = sectorOf(e, ix); bySector.set(sec, (bySector.get(sec) ?? 0) + e.total); all += e.total; if (sec !== 'Not classified') classified += e.total;
  }
  const sector: LimitRow[] = equity > 0 ? [...bySector].filter(([k]) => k !== 'Not classified').map(([k, v]) => ({ kind: 'Sector' as const, name: k, value: v, pct: v / equity, limit: s.sector, over: v / equity > s.sector })) : [];
  const fundTotal = funds.reduce((t, f) => t + f.value, 0);
  for (const f of funds) house.set(fundHouse(f.name), (house.get(fundHouse(f.name)) ?? 0) + f.value);
  const houseRows: LimitRow[] = fundTotal > 0 ? [...house].map(([k, v]) => ({ kind: 'Fund house' as const, name: k, value: v, pct: v / fundTotal, limit: s.house, over: v / fundTotal > s.house })) : [];
  const sort = (a: LimitRow[]) => a.sort((x, y) => y.pct - x.pct);
  return { company: sort(company), sector: sort(sector), house: sort(houseRows), classifiedShare: all > 0 ? classified / all : null };
}

export interface Goal { id: string; name: string; amount: number; date: string; holdings: string[] }
export interface GoalHolding { name: string; value: number; riskClass: boolean }   // riskClass: equity, sector, international or similar that can fall hard
export interface GoalStatus { funded: number; pct: number; months: number; shortfall: number; perMonth: number | null; riskShare: number; warn: string | null; missing: string[] }
export const GOAL_SOON_MONTHS = 36, GOAL_RISK_SHARE = 0.3;

export function goalStatus(g: Goal, held: GoalHolding[], today: string): GoalStatus {
  const by = new Map(held.map((h) => [h.name, h])), parts = g.holdings.map((n) => by.get(n)).filter((x): x is GoalHolding => !!x);
  const missing = g.holdings.filter((n) => !by.has(n));
  const funded = parts.reduce((t, h) => t + h.value, 0), risky = parts.filter((h) => h.riskClass).reduce((t, h) => t + h.value, 0);
  const months = Math.round((Date.parse(g.date) - Date.parse(today)) / (30.4375 * 86400000)), shortfall = Math.max(0, g.amount - funded);
  const riskShare = funded > 0 ? risky / funded : 0;
  const warn = months <= 0 ? (shortfall > 0 ? 'The date has passed and the goal is not fully funded.' : null)
    : months <= GOAL_SOON_MONTHS && riskShare > GOAL_RISK_SHARE ? `${Math.round(riskShare * 100)}% of this goal's money is in equity-type holdings and it is needed within ${months} months: a fall just before the date would hit it directly.` : null;
  return { funded, pct: g.amount > 0 ? funded / g.amount : 0, months, shortfall, perMonth: months > 0 && shortfall > 0 ? shortfall / months : null, riskShare, warn, missing };
}
