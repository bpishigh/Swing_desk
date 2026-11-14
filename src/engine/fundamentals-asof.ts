// Batch A, A0 (claude/batch-a-fundamentals-rules-draft.md): the company-figures table. Pure: the as-of results view plus a close and the splits in, one feature object out. No file, network or clock access.
// Rules: original filings only, consolidated where filed (filings-asof.ts); a figure that cannot be built from consecutive quarters on one basis is null, never 0; operating EBIT leaves out other income; exceptional items are kept apart;
// market cap uses the share count rolled forward for splits and bonuses since the filing; financial companies (banks, insurers, NBFCs) get no revenue-based or EBIT-based figures.
import type { QuarterView, View } from './filings-asof.ts';

export interface Split { date: string; factor: number }   // factor scales closes before the date (0.5 for a 1:1 bonus), as in india-asof.ts
export interface Quarter { period: string; basis: 'consolidated' | 'standalone'; asOf: string; revenue: number | null; pbt: number | null; pat: number | null; eps: number | null; pbtPre: number | null; otherIncome: number | null; financeCost: number | null; depreciation: number | null; exceptional: number | null }
export interface Balance { period: string; assets: number | null; equity: number | null; borrowings: number | null; borrowingsCurrent: number | null; cash: number | null; cashPlain?: number | null; liquidBasis?: 'cash+bank+current investments' | 'cash only'; currentAssets: number | null; currentLiabilities: number | null; ppe: number | null; inventories: number | null; receivables: number | null }
export interface FyBlock { end: string; assets: number | null; equity: number | null; borrowings: number | null; currentAssets: number | null; currentLiabilities: number | null; revenue: number | null; ebit: number | null; pat: number | null; cfo: number | null }
export interface FyPair { cur: FyBlock; prev: FyBlock; shareRatio: number | null }
export interface Features {
  entity: string; t: string; asOf: string | null; latestPeriod: string | null; basis: 'consolidated' | 'standalone' | null; financial: boolean; basisBreak: boolean;
  ttm: { revenue: number | null; pbtPre: number | null; pat: number | null; eps: number | null; operatingEbit: number | null; financeCost: number | null; exceptional: number | null; pbt: number | null };
  ttmPrev: { revenue: number | null; pbtPre: number | null; pat: number | null };
  margin: { operatingEbit: number | null; pbtPre: number | null };
  interestCover: number | null;
  growth: { revenue: number | null; pbtPre: number | null; pat: number | null; revenueCagr3: number | null };
  fiscalYears: Array<{ end: string; revenue: number | null; operatingEbit: number | null; pat: number | null }>;
  quarterlyEbitMargin: Array<number | null>;   // latest first, up to 12
  shares: number | null; sharesYearAgoRolled: number | null; sharesFlag: boolean; marketCap: number | null; earningsYield: number | null; eyNullReason: string | null;
  bs: Balance | null; bsPrev: Balance | null; cashFlowFy: Array<{ end: string; cfo: number | null; capex: number | null }>;
  netDebt: number | null; enterpriseValue: number | null; returnOnCapital: number | null;
  fy: FyPair | null;   // latest fiscal year with a year-end balance sheet, and the year before (B2 Piotroski, fiscal-year basis)
  sue: { value: number | null; epsChange: number | null; period: string | null; reason: string };
  missing: string[];
}

const FINANCIAL = new Set(['IFBanking', 'IFLI', 'IFNBFC']);
const nz = (x: number | null | undefined): number | null => (x == null || !Number.isFinite(x) ? null : x);
const addMonths = (p: string, n: number): string => { const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)) - 1 + n; const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12; const last = [31, (yy % 4 === 0 && (yy % 100 !== 0 || yy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm]; return `${yy}-${String(mm + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`; };
const sum = (xs: Array<number | null>): number | null => (xs.length && xs.every((x) => x != null) ? (xs as number[]).reduce((a, b) => a + b, 0) : null);
const sd = (xs: number[]): number => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

function toQuarter(v: QuarterView): Quarter {
  const q = v.extra?.q ?? {};
  const pbt = nz(v.values.pbt);
  const exceptional = nz(q.exceptional) ?? null;
  const pbtPre = nz(q.pbtPre) ?? (pbt != null && exceptional != null ? pbt - exceptional : exceptional == null ? pbt : null);   // without an exceptional line the quarter has none to remove only when the file also lacks the tag: then PBT stands in
  return { period: v.period, basis: v.basis, asOf: v.asOf, revenue: nz(v.values.revenue), pbt, pat: nz(v.values.pat), eps: nz(v.values.eps), pbtPre, otherIncome: nz(q.otherIncome), financeCost: nz(q.financeCost), depreciation: nz(q.depreciation), exceptional };
}
const balanceOf = (v: QuarterView): Balance | null => { const b = v.extra?.bs; if (!b || b.assets == null) return null; return { period: v.period, assets: b.assets ?? null, equity: b.equity ?? null, borrowings: b.borrowings ?? null, borrowingsCurrent: b.borrowingsCurrent ?? null, cash: b.cash == null ? null : b.cash + (b.bankOther ?? 0) + (b.currentInvestments ?? 0), cashPlain: b.cash ?? null, liquidBasis: b.v === 2 || b.currentInvestments != null || b.bankOther != null ? 'cash+bank+current investments' : 'cash only', currentAssets: b.currentAssets ?? null, currentLiabilities: b.currentLiabilities ?? null, ppe: b.ppe ?? null, inventories: b.inventories ?? null, receivables: b.receivables ?? null }; };

/** The latest `n` consecutive quarters ending at index `from` of the latest-first list, all on one basis; null if a quarter is missing or the basis differs. */
function chain(qs: Quarter[], from: number, n: number): Quarter[] | null {
  if (qs.length < from + n) return null;
  const c = qs.slice(from, from + n);
  for (let i = 1; i < c.length; i++) if (addMonths(c[i].period, 3) !== c[i - 1].period || c[i].basis !== c[0].basis) return null;
  return c;
}

/** Fiscal year end month of a company (3, 6, 9 or 12), read from the stored year-to-date columns: for each candidate month, count quarters whose year-to-date equals the sum of the quarters since that year start (within 1% for rounding). Null if fewer than 2 quarters can vote or the best month does not win clearly. */
export function fiscalEndMonth(view: View): number | null {
  const qv = view.quarters, votes: Record<number, number> = { 3: 0, 6: 0, 9: 0, 12: 0 }; let voters = 0;
  for (let i = 0; i < qv.length; i++) {
    const v = qv[i], key = (['revenue', 'pat'] as const).find((k) => v.ytd?.[k] != null && v.values[k] != null); if (!key) continue; voters++;
    const pm = Number(v.period.slice(5, 7));
    for (const m of [3, 6, 9, 12]) {
      const k = ((((pm - m) % 12) + 12) % 12) / 3 || 4;   // quarters of this fiscal year so far, if the year ends in month m
      if (qv.length < i + k) continue;
      let ok = true, tot = 0; for (let j = 0; j < k; j++) { const w = qv[i + j]; if (w.basis !== v.basis || (j > 0 && addMonths(w.period, 3 * j) !== v.period) || w.values[key] == null) { ok = false; break; } tot += w.values[key] as number; }
      const y = v.ytd![key] as number; if (ok && Math.abs(tot - y) <= 0.01 * Math.max(Math.abs(y), 1)) votes[m]++;
    }
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return voters >= 2 && ranked[0][1] >= 2 && ranked[0][1] > ranked[1][1] ? Number(ranked[0][0]) : null;
}

export function computeFeatures(view: View, close: number | null, splits: Split[], opt: { fiscalEnd?: number | null; sueShareRule?: 'both' | 'increase' } = {}): Features {
  const qv = view.quarters, qs = qv.map(toQuarter), t = view.t;
  const latest = qv[0] ?? null, financial = latest?.format != null && FINANCIAL.has(latest.format);
  const missing: string[] = [];
  const c4 = chain(qs, 0, 4), p4 = chain(qs, 4, 4), y3 = chain(qs, 12, 4);
  const f = (c: Quarter[] | null, k: keyof Quarter) => (c ? sum(c.map((q) => q[k] as number | null)) : null);
  const ttmRevenue = financial ? null : f(c4, 'revenue'), ttmPbtPre = f(c4, 'pbtPre'), ttmPat = f(c4, 'pat'), ttmEps = f(c4, 'eps'), ttmFin = f(c4, 'financeCost'), ttmOther = f(c4, 'otherIncome'), ttmExc = f(c4, 'exceptional'), ttmPbt = f(c4, 'pbt');
  const ebit = (c: Quarter[] | null): number | null => { if (!c || financial) return null; const a = f(c, 'pbtPre'), b = f(c, 'financeCost'), o = f(c, 'otherIncome'); return a != null && b != null && o != null ? a + b - o : null; };
  const opEbit = ebit(c4);
  const prevRev = financial ? null : f(p4, 'revenue'), prevPbt = f(p4, 'pbtPre'), prevPat = f(p4, 'pat'), rev3 = financial ? null : f(y3, 'revenue');
  const g = (cur: number | null, prev: number | null) => (cur != null && prev != null && prev > 0 ? cur / prev - 1 : null);
  const sameBasis = !!(c4 && p4 && c4[0].basis === p4[0].basis) && !qv.slice(0, 8).some((q) => q.basisBreak) && !view.flags.some((x) => x.kind === 'structure event' && x.date > (qs[7]?.period ?? '9999'));
  const growth = { revenue: sameBasis ? g(ttmRevenue, prevRev) : null, pbtPre: sameBasis ? g(ttmPbtPre, prevPbt) : null, pat: sameBasis ? g(ttmPat, prevPat) : null, revenueCagr3: sameBasis && y3 && ttmRevenue != null && rev3 != null && rev3 > 0 && ttmRevenue > 0 && !view.flags.some((x) => x.kind === 'structure event' && x.date > (qs[15]?.period ?? '9999')) ? Math.pow(ttmRevenue / rev3, 1 / 3) - 1 : null };
  const interestCover = opEbit != null && ttmFin != null ? (ttmFin <= 0 ? 20 : Math.min(20, opEbit / ttmFin)) : null;

  // fiscal years (own year end): four consecutive quarters ending at the year-end quarter
  const fe = opt.fiscalEnd !== undefined ? opt.fiscalEnd : fiscalEndMonth(view); const fiscalYears: Features['fiscalYears'] = [];
  if (fe != null) for (let i = 0; i < qs.length; i++) if (Number(qs[i].period.slice(5, 7)) === fe) { const c = chain(qs, i, 4); if (c) fiscalYears.push({ end: qs[i].period, revenue: financial ? null : f(c, 'revenue'), operatingEbit: ebit(c), pat: f(c, 'pat') }); }
  const quarterlyEbitMargin: Array<number | null> = [];
  for (let i = 0; i < Math.min(12, qs.length); i++) { const q = qs[i]; quarterlyEbitMargin.push(!financial && q.revenue != null && q.revenue > 0 && q.pbtPre != null && q.financeCost != null && q.otherIncome != null ? (q.pbtPre + q.financeCost - q.otherIncome) / q.revenue : null); }

  // shares: paid-up capital over face value as last filed, rolled forward for splits and bonuses between that filing and t
  let shares: number | null = null, sharesFlag = false;
  // Some filers enter paid-up capital in lakh, crore or thousand instead of rupees. The share count implied by the same quarter's profit over EPS says which; a count that fits no unit within a factor of 3 is not used.
  const sh = (i: number): number | null => {
    const e = qv[i]?.extra?.q, v = qv[i]?.values; if (!(e?.paidUp != null && e?.faceValue != null && e.faceValue > 0)) return null;
    if (![0.1, 0.25, 0.5, 1, 2, 2.5, 5, 10, 100].includes(e.faceValue)) return null;   // a face value that is not a rupee denomination in use is a mis-tagged filing (one filer entered 160.02)
    const raw = e.paidUp / e.faceValue, implied = v && v.pat != null && v.eps != null && v.eps !== 0 ? Math.abs(v.pat / v.eps) : null;
    if (implied == null || !(implied > 0)) return raw;
    let best = 0, bd = Infinity; for (const m of [1, 1e3, 1e5, 1e6, 1e7]) { const d = Math.abs(Math.log((raw * m) / implied)); if (d < bd) { bd = d; best = m; } }
    return bd <= Math.log(3) ? raw * best : null;
  };
  const sh0 = sh(0);
  if (sh0 != null && latest) { let m = 1; for (const s of splits) if (s.date > latest.asOf.slice(0, 10) && s.date <= t && s.factor > 0) m /= s.factor; shares = sh0 * m; const sh4 = sh(4); if (sh4 != null && Math.abs(sh0 / sh4 - 1) > 0.02) sharesFlag = true; }
  let sharesYearAgoRolled: number | null = null; { const s4 = sh(4); if (s4 != null && qv[4]) { let m = 1; for (const sp of splits) if (sp.date > qv[4].asOf.slice(0, 10) && sp.date <= t && sp.factor > 0) m /= sp.factor; sharesYearAgoRolled = s4 * m; } }
  const marketCap = close != null && close > 0 && shares != null ? close * shares : null;
  let earningsYield: number | null = null, eyNullReason: string | null = null;
  if (marketCap == null) eyNullReason = 'no market cap'; else if (ttmPat == null) eyNullReason = 'no TTM profit';
  else if (ttmPbt != null && ttmExc != null && ttmPbt !== 0 && Math.abs(ttmExc) > 0.25 * Math.abs(ttmPbt)) eyNullReason = 'exceptional items above 25% of PBT';
  else earningsYield = ttmPat / marketCap;

  // balance sheet: latest filing with one, and the one 12 months earlier
  let bs: Balance | null = null, bsPrev: Balance | null = null;
  for (let i = 0; i < qv.length; i++) { const b = balanceOf(qv[i]); if (b) { bs = b; const pi = qv.findIndex((x) => x.period === addMonths(b.period, -12)); bsPrev = pi >= 0 ? balanceOf(qv[pi]) : null; break; } }
  const cashFlowFy: Features['cashFlowFy'] = [];
  if (fe != null) for (const v of qv) if (Number(v.period.slice(5, 7)) === fe && v.extra?.cf?.cfo != null) cashFlowFy.push({ end: v.period, cfo: v.extra.cf.cfo ?? null, capex: v.extra.cf.capex ?? null });
  // fiscal-year pair: the latest two fiscal-year-end quarters (12 months apart) that each have a balance sheet and four consecutive quarters of flows; shares of both rolled through splits and bonuses to t so their ratio is free of those
  let fy: FyPair | null = null;
  if (fe != null) {
    const blk = (i: number): FyBlock | null => { const b = balanceOf(qv[i]), c = chain(qs, i, 4); if (!b || !c) return null; return { end: qs[i].period, assets: b.assets, equity: b.equity, borrowings: b.borrowings, currentAssets: b.currentAssets, currentLiabilities: b.currentLiabilities, revenue: financial ? null : f(c, 'revenue'), ebit: ebit(c), pat: f(c, 'pat'), cfo: qv[i].extra?.cf?.cfo ?? null }; };
    const rolled = (i: number): number | null => { const s0 = sh(i); if (s0 == null) return null; let m = 1; for (const sp of splits) if (sp.date > qv[i].asOf.slice(0, 10) && sp.date <= t && sp.factor > 0) m /= sp.factor; return s0 * m; };
    for (let i = 0; i < qs.length && !fy; i++) {
      if (Number(qs[i].period.slice(5, 7)) !== fe) continue;
      const cur = blk(i); if (!cur) break;   // the latest fiscal-year end only; an older year is not used in its place
      const j = qs.findIndex((x) => x.period === addMonths(qs[i].period, -12)); if (j < 0) break;
      const prev = blk(j); if (!prev) break;
      const a = rolled(i), b = rolled(j);
      fy = { cur, prev, shareRatio: a != null && b != null && b > 0 ? a / b : null };
    }
  }
  const netDebt = bs && bs.borrowings != null && bs.cash != null ? bs.borrowings - bs.cash : null;
  const enterpriseValue = marketCap != null && netDebt != null ? marketCap + netDebt : null;
  // return on capital (Greenblatt): operating EBIT over net working capital (without cash, bank deposits, current investments and short debt; floored at zero) plus fixed assets
  let returnOnCapital: number | null = null;
  if (!financial && bs && opEbit != null && bs.currentAssets != null && bs.currentLiabilities != null && bs.cash != null && bs.ppe != null) { const nwc = (bs.currentAssets - bs.cash) - (bs.currentLiabilities - (bs.borrowingsCurrent ?? 0)); const cap = Math.max(nwc, 0) + bs.ppe; if (cap > 0) returnOnCapital = opEbit / cap; }

  // standardised unexpected earnings: this quarter's EPS minus the EPS four quarters earlier, over the standard deviation of that difference in the previous 8 quarters (at least 6)
  let sue: Features['sue'] = { value: null, epsChange: null, period: latest?.period ?? null, reason: 'no quarters' };
  if (latest) {
    const diff = (i: number): number | null => { const a = qs[i], b = qs[i + 4]; if (!a || !b || a.basis !== b.basis || a.eps == null || b.eps == null || addMonths(b.period, 12) !== a.period) return null;
      const own = qv[i]?.extra?.q?.epsPrior; return own != null ? a.eps - own : a.eps - b.eps; };   // US: the year-ago EPS as printed in the same filing (split-adjusted by the filer); India: the year-ago quarter's own filing
    const d0 = diff(0), prior: number[] = []; for (let i = 1; i <= 8; i++) { const d = diff(i); if (d != null) prior.push(d); }
    const e0 = qv[0].extra?.q, e4 = qv[4]?.extra?.q; const y4 = qs[4];
    const exc = (q: Quarter | undefined) => !!q && q.exceptional != null && q.pbt != null && q.pbt !== 0 && Math.abs(q.exceptional) > 0.25 * Math.abs(q.pbt);
    if (d0 == null) sue = { ...sue, reason: 'no EPS change (missing year-ago quarter, basis change or EPS missing)' };
    else if (exc(qs[0]) || exc(qs[4])) sue = { value: null, epsChange: d0, period: latest.period, reason: 'exceptional items above 25% of PBT in the quarter or the year-ago quarter' };
    else if (sh(0) != null && sh(4) != null && (opt.sueShareRule === 'increase' ? (sh(0) as number) / (sh(4) as number) - 1 : Math.abs((sh(0) as number) / (sh(4) as number) - 1)) > 0.02) sue = { value: null, epsChange: d0, period: latest.period, reason: 'share count moved more than 2% from the year-ago quarter' };
    else if (close != null && close > 0 && Math.abs(d0) < 0.005 * close) sue = { value: null, epsChange: d0, period: latest.period, reason: 'EPS change below 0.5% of the close' };
    else if (prior.length < 6) sue = { value: null, epsChange: d0, period: latest.period, reason: 'fewer than 6 earlier changes' };
    else { const s = sd(prior); sue = s > 0 ? { value: d0 / s, epsChange: d0, period: latest.period, reason: 'ok' } : { value: null, epsChange: d0, period: latest.period, reason: 'zero spread' }; }
    void e0; void e4; void y4;
  }
  if (c4 == null) missing.push('ttm'); if (p4 == null) missing.push('ttmPrev'); if (marketCap == null) missing.push('marketCap'); if (bs == null) missing.push('balanceSheet');
  return {
    entity: view.entity, t, asOf: latest?.asOf ?? null, latestPeriod: latest?.period ?? null, basis: latest?.basis ?? null, financial, basisBreak: qv.slice(0, 8).some((q) => q.basisBreak),
    ttm: { revenue: ttmRevenue, pbtPre: ttmPbtPre, pat: ttmPat, eps: ttmEps, operatingEbit: opEbit, financeCost: ttmFin, exceptional: ttmExc, pbt: ttmPbt },
    ttmPrev: { revenue: prevRev, pbtPre: prevPbt, pat: prevPat },
    margin: { operatingEbit: opEbit != null && ttmRevenue != null && ttmRevenue > 0 ? opEbit / ttmRevenue : null, pbtPre: ttmPbtPre != null && ttmRevenue != null && ttmRevenue > 0 ? ttmPbtPre / ttmRevenue : null },
    interestCover, growth, fiscalYears, quarterlyEbitMargin, shares, sharesYearAgoRolled, sharesFlag, marketCap, earningsYield, eyNullReason, bs, bsPrev, cashFlowFy, netDebt, enterpriseValue, returnOnCapital, fy, sue, missing,
  };
}
export { sd as stdev, sum };

/** A7 flags (information only, no book uses them): dilution (share count up more than 5% over a year after removing splits and bonuses), exceptional items above 25% of TTM PBT, profit up more than 20% while revenue fell. Pledge needs the shareholding filings and is not here. */
export function flagsOf(f: Features): { dilution: boolean | null; exceptional: boolean | null; profitWithoutSales: boolean | null } {
  const dil = f.shares != null && f.sharesYearAgoRolled != null && f.sharesYearAgoRolled > 0 ? f.shares / f.sharesYearAgoRolled - 1 > 0.05 : null;
  const exc = f.ttm.pbt != null && f.ttm.exceptional != null && f.ttm.pbt !== 0 ? Math.abs(f.ttm.exceptional) > 0.25 * Math.abs(f.ttm.pbt) : null;
  const pws = f.growth.pat != null && f.growth.revenue != null ? f.growth.pat > 0.2 && f.growth.revenue < 0 : null;
  return { dilution: dil, exceptional: exc, profitWithoutSales: pws };
}
