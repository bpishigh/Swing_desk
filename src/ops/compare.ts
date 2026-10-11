// Side-by-side of the Claude Desk's stored numbers and the Repo Desk's for one session. Pure: the script supplies both sides.
// Status per field: match (inside the tolerance), differs (outside it), missing (one side has no value).

export type Status = 'match' | 'differs' | 'missing';
export interface Row { market: 'India' | 'US'; item: string; field: string; claude: number | null; repo: number | null; diff: number | null; unit: '%' | 'pts'; status: Status; note?: string }
export interface Side { tracker?: Record<string, any> | null; feedHist?: { sectors?: Record<string, Record<string, any>> } | null; breadth?: number | null }
export interface Summary { rows: number; match: number; differs: number; missing: number }

// Tolerances. Percent of the value for prices and averages, points for returns and breadth.
const TOL = {
  close: { t: 0.05, u: '%' as const }, high: { t: 0.05, u: '%' as const }, low: { t: 0.05, u: '%' as const },
  volume: { t: 5, u: '%' as const },            // sources differ on consolidated vs primary-exchange volume
  sma50: { t: 0.5, u: '%' as const },
  sma200: { t: 0.5, u: '%' as const },          // the Claude Desk used TipRanks (dividend-adjusted) for some US 200 SMAs: known gap up to 1.7%
  vix: { t: 0.5, u: '%' as const },
  r1m: { t: 0.1, u: 'pts' as const }, r3m: { t: 0.1, u: 'pts' as const },
  breadth: { t: 3, u: 'pts' as const },         // India: typed scan vs Nifty 500 computed
};
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function cell(market: Row['market'], item: string, field: keyof typeof TOL, a: unknown, b: unknown, note?: string): Row {
  const c = num(a), r = num(b), tol = TOL[field];
  if (c === null || r === null) return { market, item, field, claude: c, repo: r, diff: null, unit: tol.u, status: 'missing', ...(note ? { note } : {}) };
  const known = knownCause(market, field, c, r);
  const diff = tol.u === '%' ? (c === 0 ? 0 : (r / c - 1) * 100) : r - c;
  const rd = Math.round(diff * 100) / 100;
  return { market, item, field, claude: c, repo: r, diff: rd, unit: tol.u, status: Math.abs(diff) <= tol.t ? 'match' : 'differs', ...(note ? { note } : known && Math.abs(diff) > tol.t ? { note: known } : {}) };
}

/** Differences already explained in the Engine Rules / README, so a reader does not chase them again. */
function knownCause(market: Row['market'], field: string, c: number, r: number): string | undefined {
  if (market === 'US' && field === 'sma200' && Math.abs(r / c - 1) < 0.02) return 'known: the Claude Desk used TipRanks for some 200 SMAs (dividend-adjusted, runs lower)';
  if (market === 'US' && field === 'r3m') return 'check: the Claude Desk takes 3-month returns from etfdb when stored closes are short';
  if (market === 'India' && (field === 'r1m' || field === 'r3m')) return 'check: the Claude Desk often carried returns from an earlier day (see its own flags)';
  return undefined;
}

export function compareMarket(market: Row['market'], claude: Side, repo: Side): Row[] {
  const rows: Row[] = [];
  const ct = claude.tracker ?? {}, rt = repo.tracker ?? {};
  for (const f of ['close', 'high', 'low', 'volume', 'sma50', 'sma200', 'vix'] as const) {
    if (f === 'vix' && ct.vix === undefined && rt.vix === undefined) continue;
    rows.push(cell(market, market === 'India' ? 'Nifty 50' : 'SPY', f, ct[f], rt[f]));
  }
  for (const f of ['close', 'sma50', 'sma200'] as const) rows.push(cell(market, market === 'India' ? 'Nifty 500' : 'QQQ', f, ct.b?.[f], rt.b?.[f]));
  rows.push(cell(market, 'Breadth', 'breadth', claude.breadth ?? ct.breadth, repo.breadth ?? rt.breadth, market === 'India' ? 'typed scan vs Nifty 500 above 50-day, computed' : 'typed vs S&P 500 above 50-day, computed'));
  const cs = claude.feedHist?.sectors ?? {}, rs = repo.feedHist?.sectors ?? {};
  for (const k of [...new Set([...Object.keys(cs), ...Object.keys(rs)])].sort()) {
    for (const f of ['close', 'sma50', 'sma200', 'r1m', 'r3m'] as const) rows.push(cell(market, k, f, cs[k]?.[f], rs[k]?.[f]));
  }
  return rows;
}

export function summarise(rows: Row[]): Summary {
  const s = { rows: rows.length, match: 0, differs: 0, missing: 0 };
  for (const r of rows) s[r.status]++;
  return s;
}
