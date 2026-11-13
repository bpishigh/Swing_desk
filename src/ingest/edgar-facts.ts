// US filings loader (docs/FILINGS_LOADER_SPEC.md step 6, Batch A US versions): SEC EDGAR "company facts" for one company in, quarterly results in the same shape as the India filings out, so the as-of view
// (filings-asof.ts) and the company-figures table (fundamentals-asof.ts) read them unchanged. Pure: no network, no clock.
// What it does: for every fiscal quarter it takes the value from the earliest filing that reported it (the original, never a restatement), the date of that filing as the as-of date, and for the fourth quarter
// (never filed on its own) the full-year figure less the nine-month figure. Periods are put on calendar month ends (a 52 or 53 week quarter ending 27 Sep is 30 Sep) so quarter chains line up.
// Mapping to the India shape (a quarter with no interest-expense figure keeps financeCost null, never zero): revenue, pbt (pre-tax income), pat (net income attributable to the parent), eps (diluted); extra.q: financeCost (interest expense), otherIncome (derived so that operating EBIT equals
// reported operating income), pbtPre (= pbt, there is no separate exceptional line), paidUp (shares outstanding on the filing's cover) with faceValue 1; extra.bs from instants at period end; extra.cf from year-to-date flows.
// Missing stays null, never zero. Banks, insurers and other financial SIC groups carry format 'IFBanking' so strategies that skip financials do.
import type { Values, Extra } from './filings-parse.ts';

export interface UsRow { start?: string; end: string; val: number; accn: string; fy?: number; fp?: string; form: string; filed: string }
export interface CompanyFacts { cik?: number; entityName?: string; facts?: Record<string, Record<string, { units?: Record<string, UsRow[]> }>> }
export interface UsQuarter { period: string; basis: 'consolidated'; asOf: string; revision: 0; fields: Values; ytd: Values; format: string; extra: Extra; form: string; accn: string; fp: string }

/** Concept chains, first one that has a value wins, per period. */
export const CHAINS = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet', 'RevenuesNetOfInterestExpense'],
  pbt: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
  pat: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
  opInc: ['OperatingIncomeLoss'],
  interest: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestAndDebtExpense', 'InterestExpenseLongTermDebt', 'InterestExpenseOther', 'InterestExpenseDebtExcludingAmortization'],
  nonOp: ['NonoperatingIncomeExpense'],
  cfo: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  assets: ['Assets'], equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  debtLong: ['LongTermDebtNoncurrent', 'LongTermDebt'], debtCurrent: ['LongTermDebtCurrent', 'DebtCurrent', 'ShortTermBorrowings', 'CommercialPaper'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  currentAssets: ['AssetsCurrent'], currentLiabilities: ['LiabilitiesCurrent'], ppe: ['PropertyPlantAndEquipmentNet'], inventories: ['InventoryNet'], receivables: ['AccountsReceivableNetCurrent'],
} as const;
export const ALL_CONCEPTS: string[] = [...new Set(Object.values(CHAINS).flat())];
export const DEI_SHARES = 'EntityCommonStockSharesOutstanding';
/** Keep only what the parser reads (for fixtures and small stores). */
export function trim(cf: CompanyFacts): CompanyFacts {
  const out: CompanyFacts = { cik: cf.cik, entityName: cf.entityName, facts: { 'us-gaap': {}, dei: {} } }, g = cf.facts?.['us-gaap'] ?? {};
  for (const c of ALL_CONCEPTS) if (g[c]) out.facts!['us-gaap'][c] = g[c];
  const d = cf.facts?.dei?.[DEI_SHARES]; if (d) out.facts!.dei[DEI_SHARES] = d;
  return out;
}

const DAY = 864e5, days = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
/** Calendar month end nearest a fiscal period end: day 16 and later rounds to that month's end, earlier to the previous month's. */
export function monthEnd(date: string): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  let yy = y, mm = d >= 16 ? m : m - 1; if (mm === 0) { mm = 12; yy--; }
  const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate(); return `${yy}-${String(mm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}
export const formatOfSic = (sic: number | null | undefined): string => (sic != null && [60, 61, 62, 63, 64, 67].includes(Math.floor(sic / 100)) ? 'IFBanking' : 'IndAs');

type Kind = 'Q' | 'H' | 'N' | 'Y';   // 3, 6, 9, 12 months
const kindOf = (r: UsRow): Kind | null => { if (!r.start) return null; const n = days(r.start, r.end); return n >= 75 && n <= 105 ? 'Q' : n >= 160 && n <= 200 ? 'H' : n >= 250 && n <= 290 ? 'N' : n >= 340 && n <= 380 ? 'Y' : null; };
const okForm = (f: string): boolean => /^10-[QK](\/A)?$/.test(f) || f === '10-KT';

/** Earliest-filed value per (end, kind) for a concept chain: the first concept in the chain that has any value for that key. */
function flows(g: Record<string, { units?: Record<string, UsRow[]> }>, chain: readonly string[], unit: string): Map<string, { val: number; filed: string; accn: string }> {
  const out = new Map<string, { val: number; filed: string; accn: string }>();
  for (const c of chain) {
    const rows = g[c]?.units?.[unit]; if (!rows) continue;
    const best = new Map<string, UsRow>();
    for (const r of rows) { if (!okForm(r.form)) continue; const k = kindOf(r); if (!k) continue; const key = `${r.end}|${k}`; const cur = best.get(key); if (!cur || r.filed < cur.filed) best.set(key, r); }
    for (const [key, r] of best) if (!out.has(key)) out.set(key, { val: r.val, filed: r.filed, accn: r.accn });
  }
  return out;
}
function instants(g: Record<string, { units?: Record<string, UsRow[]> }>, chain: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of chain) {
    const rows = g[c]?.units?.USD; if (!rows) continue; const best = new Map<string, UsRow>();
    for (const r of rows) { if (!okForm(r.form) || r.start) continue; const cur = best.get(r.end); if (!cur || r.filed < cur.filed) best.set(r.end, r); }
    for (const [end, r] of best) if (!out.has(end)) out.set(end, r.val);
  }
  return out;
}
const addDays = (d: string, n: number): string => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
/** The key of the flow ending at `end` of a given kind, allowing a few days either way (fiscal quarters end on 52 or 53 week calendars; the filing dates differ a day between concepts). */
const near = <T>(m: Map<string, T>, end: string, k: Kind): T | undefined => { for (const d of [0, 1, -1, 2, -2, 3, -3]) { const v = m.get(`${addDays(end, d)}|${k}`); if (v) return v; } return undefined; };

export function buildQuarters(cf: CompanyFacts, sic: number | null = null): UsQuarter[] {
  const g = cf.facts?.['us-gaap'] ?? {}; if (!Object.keys(g).length) return [];
  const F: Record<string, ReturnType<typeof flows>> = {};
  for (const k of ['revenue', 'pbt', 'pat', 'opInc', 'interest', 'nonOp', 'cfo', 'capex'] as const) F[k] = flows(g, CHAINS[k], 'USD');
  F.eps = flows(g, CHAINS.eps, 'USD/shares');
  const B: Record<string, Map<string, number>> = {}; for (const k of ['assets', 'equity', 'debtLong', 'debtCurrent', 'cash', 'currentAssets', 'currentLiabilities', 'ppe', 'inventories', 'receivables'] as const) B[k] = instants(g, CHAINS[k]);
  const dei = cf.facts?.dei?.[DEI_SHARES]?.units?.shares ?? [], shareByAccn = new Map<string, number>(); for (const r of dei) if (okForm(r.form) && !shareByAccn.has(r.accn)) shareByAccn.set(r.accn, r.val);
  // fiscal period ends: every end that has a 3-month (or, for the fourth quarter, a 12-month) flow of net income or revenue
  const ends = new Set<string>(); for (const m of [F.pat, F.revenue]) for (const key of m.keys()) { const [e, k] = key.split('|'); if (k === 'Q' || k === 'Y') ends.add(e); }
  const val = (k: string, end: string, kind: Kind): { val: number; filed: string; accn: string } | undefined => near(F[k], end, kind);
  const instAt = (k: string, end: string): number | null => { for (const d of [0, 1, -1, 2, -2, 3, -3]) { const v = B[k].get(addDays(end, d)); if (v != null) return v; } return null; };
  const out = new Map<string, UsQuarter>();
  for (const end of [...ends].sort()) {
    const q = (k: string): { val: number | null; filed: string | null; accn: string | null } => {
      const d = val(k, end, 'Q'); if (d) return { val: d.val, filed: d.filed, accn: d.accn };
      const y = val(k, end, 'Y'); if (!y) return { val: null, filed: null, accn: null };
      // fourth quarter: full year less the nine months that ended three months before the year end
      const nEnd = addDays(end, -91); let n: { val: number } | undefined; for (const dd of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) { const v = near(F[k], addDays(nEnd, dd), 'N'); if (v) { n = v; break; } }
      return n ? { val: y.val - n.val, filed: y.filed, accn: y.accn } : { val: null, filed: null, accn: null };
    };
    const ytdOf = (k: string): number | null => { for (const kind of ['Y', 'N', 'H', 'Q'] as Kind[]) { const v = val(k, end, kind); if (v) return v.val; } return null; };
    // EPS of the year-ago quarter as printed in THIS quarter's filing (its comparative column): split-adjusted by the filer, so a year-on-year change is never taken across a split. The fourth quarter's is the prior year less nine months as printed in this and the third-quarter filing.
    const epsPrior = ((): number | null => {
      const prevEnd = addDays(end, -364), rows = (g[CHAINS.eps.find((c) => g[c]?.units?.['USD/shares']) ?? '']?.units?.['USD/shares'] ?? []).filter((r) => okForm(r.form));
      const pick = (e: string, kind: Kind, accn: string | null): number | null => { for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) { const x = rows.find((r) => r.end === addDays(e, d) && kindOf(r) === kind && (accn == null || r.accn === accn)); if (x) return x.val; } return null; };
      const cur = val('eps', end, 'Q'); if (cur) return pick(prevEnd, 'Q', cur.accn);
      const y = val('eps', end, 'Y'); if (!y) return null; const n = val('eps', addDays(end, -91), 'N'); const fy = pick(prevEnd, 'Y', y.accn), nine = n ? pick(addDays(prevEnd, -91), 'N', n.accn) : null;
      return fy != null && nine != null ? fy - nine : null;
    })();
    const rev = q('revenue'), pbt = q('pbt'), pat = q('pat'), eps = q('eps'), op = q('opInc'), intr = q('interest'), nonOp = q('nonOp');
    const filedSrc = pat.filed ?? rev.filed; if (!filedSrc) continue;   // a quarter needs a profit or revenue figure and a filing date
    const accn = pat.accn ?? rev.accn ?? '';
    const fiscalEnd = monthEnd(end); const fp = (() => { const y = val('pat', end, 'Y'); return y ? 'FY' : val('pat', end, 'Q') ? 'Q' : ''; })();
    // Interest expense is read as reported; a quarter with no interest figure under any of the tags above stays null (never zero), so interest cover is not scored for it and the strategies that need it leave the name out.
    const pbtV = pbt.val, intV = intr.val;
    const otherIncome = pbtV != null && intV != null && op.val != null ? pbtV + intV - op.val : nonOp.val;
    const ytdV = (k: string): number | null => ytdOf(k);
    const debtLong = instAt('debtLong', end), debtCur = instAt('debtCurrent', end);
    const bs: Record<string, number> = {};
    const put = (o: Record<string, number>, k: string, v: number | null | undefined) => { if (v != null && Number.isFinite(v)) o[k] = v; };
    put(bs, 'assets', instAt('assets', end)); put(bs, 'equity', instAt('equity', end)); put(bs, 'cash', instAt('cash', end)); put(bs, 'currentAssets', instAt('currentAssets', end)); put(bs, 'currentLiabilities', instAt('currentLiabilities', end));
    put(bs, 'ppe', instAt('ppe', end)); put(bs, 'inventories', instAt('inventories', end)); put(bs, 'receivables', instAt('receivables', end));
    if (debtLong != null || debtCur != null) { put(bs, 'borrowings', (debtLong ?? 0) + (debtCur ?? 0)); put(bs, 'borrowingsCurrent', debtCur ?? 0); }
    const qx: Record<string, number> = {}; put(qx, 'financeCost', intV); put(qx, 'otherIncome', otherIncome); put(qx, 'pbtPre', pbtV); put(qx, 'paidUp', accn ? shareByAccn.get(accn) : undefined); put(qx, 'epsPrior', epsPrior); if (fp === 'FY') qx.epsDerived = 1; qx.faceValue = 1;
    if (qx.paidUp == null) delete qx.faceValue;
    const cfx: Record<string, number> = {}; put(cfx, 'cfo', ytdV('cfo')); put(cfx, 'capex', ytdV('capex'));
    const fields: Values = { revenue: rev.val, pbt: pbtV, pat: pat.val, eps: eps.val };
    const ytd: Values = { revenue: ytdV('revenue'), pbt: ytdV('pbt'), pat: ytdV('pat'), eps: ytdV('eps') };
    const key = fiscalEnd; if (out.has(key)) continue;
    out.set(key, { period: fiscalEnd, basis: 'consolidated', asOf: `${filedSrc}T00:00:00`, revision: 0, fields, ytd, format: formatOfSic(sic), extra: { q: qx, bs, cf: cfx }, form: fp === 'FY' ? '10-K' : '10-Q', accn, fp });
  }
  return [...out.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
}
