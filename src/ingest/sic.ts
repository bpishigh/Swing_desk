// SIC codes for the US scan's group step. Primary source: SEC (company_tickers.json for ticker -> CIK, then data.sec.gov/submissions/CIK##########.json for "sic").
// Fallback: Massive's ticker details (sic_code), a few calls a run because the free plan allows 5 a minute. Pure parsers only; the script does the fetching.

/** SEC company_tickers.json -> ticker (upper case) -> CIK. The file maps "0","1",... to {cik_str, ticker, title}. */
export function parseSecTickers(json: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!json || typeof json !== 'object') return out;
  for (const v of Object.values(json as Record<string, { cik_str?: number | string; ticker?: string }>)) {
    const cik = Number(v?.cik_str), t = typeof v?.ticker === 'string' ? v.ticker.toUpperCase() : '';
    if (t && Number.isInteger(cik) && cik > 0 && !out.has(t)) out.set(t, cik);
  }
  return out;
}
export const secSubmissionsUrl = (cik: number): string => `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`;

/** SEC submissions JSON -> SIC code and description, or null when absent (the field is a string, sometimes empty). */
export function parseSecSic(json: unknown): { sic: number; desc: string } | null {
  const j = json as { sic?: string | number; sicDescription?: string } | null;
  const sic = Number(j?.sic);
  return Number.isInteger(sic) && sic > 0 ? { sic, desc: String(j?.sicDescription ?? '') } : null;
}
/** Massive /v3/reference/tickers/{ticker} -> SIC code and description. */
export function parseMassiveSic(json: unknown): { sic: number; desc: string } | null {
  const r = (json as { results?: { sic_code?: string | number; sic_description?: string } } | null)?.results;
  const sic = Number(r?.sic_code);
  return Number.isInteger(sic) && sic > 0 ? { sic, desc: String(r?.sic_description ?? '') } : null;
}
