// Read a fund's equity portfolio out of a fund page's embedded JSON (Engine Rules C-78). Pure: no network.
import type { PortfolioLine } from './lookthrough.ts';
const find = (v: unknown, key: string, depth = 0): unknown[] | null => {
  if (depth > 12 || !v || typeof v !== 'object') return null;
  if (!Array.isArray(v) && Array.isArray((v as Record<string, unknown>)[key])) return (v as Record<string, unknown[]>)[key];
  for (const x of Array.isArray(v) ? v : Object.values(v)) { const r = find(x, key, depth + 1); if (r) return r; }
  return null;
};
// Futures, options and dated contracts sit under EQUITY in some portfolios; they are not shares of a company and must not appear as one.
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
export const isDerivative = (name: string) => new RegExp(`\\bfutures?\\s*$|\\b(call|put)\\b.*\\d|\\d{1,2}-(${MONTHS})[a-z]*-\\d{2,4}|-(${MONTHS})\\d{4}\\b|\\b(${MONTHS})[a-z]*\\.? ?20\\d\\d\\b`, 'i').test(name);
export interface Parsed { asOf: string | null; code: string | null; lines: PortfolioLine[] }
/** Equity lines only, as percent of the fund. Lines with a missing or non-positive weight are dropped; the same company on two lines is added together. */
export function parsePage(html: string): Parsed | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let j: unknown; try { j = JSON.parse(m[1]); } catch { return null; }
  const h = find(j, 'holdings'); if (!h) return null;
  const by = new Map<string, PortfolioLine>(); let asOf: string | null = null, code: string | null = null;
  for (const r of h as Record<string, unknown>[]) {
    if (String(r.nature_name ?? '').toUpperCase() !== 'EQUITY') continue;
    const w = Number(r.corpus_per), name = String(r.company_name ?? '').trim(); if (!(w > 0) || !name || isDerivative(name)) continue;
    const d = typeof r.portfolio_date === 'string' ? r.portfolio_date : null;
    // the date is stored in UTC at 18:30 the evening before (IST midnight): shift to the Indian date
    if (d) { const ist = new Date(Date.parse(d) + 5.5 * 3600000).toISOString().slice(0, 10); if (!asOf || ist > asOf) asOf = ist; }
    if (!code && r.scheme_code != null) code = String(r.scheme_code);
    const o = by.get(name); if (o) o.weight += w; else by.set(name, { name, weight: w });
  }
  return { asOf, code, lines: [...by.values()].map((l) => ({ ...l, weight: Math.round(l.weight * 1000) / 1000 })).sort((a, b) => b.weight - a.weight) };
}

export interface EtfLine { isin: string; weight: number }
/** An ETF page lists its holdings as ISIN and percent only (no names): equity ISINs (INE...) are kept, the same ISIN on two lines is added together. */
export function parseEtfPage(html: string): { lines: EtfLine[] } | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let j: unknown; try { j = JSON.parse(m[1]); } catch { return null; }
  const h = find(j, 'holdings'); if (!h) return null;
  const by = new Map<string, number>();
  for (const r of h as Record<string, unknown>[]) { const i = String(r.isin ?? ''), w = Number(r.holdingSharePercentage); if (/^INE[0-9A-Z]{9}$/.test(i) && w > 0) by.set(i, (by.get(i) ?? 0) + w); }
  return { lines: [...by].map(([isin, weight]) => ({ isin, weight: Math.round(weight * 1000) / 1000 })).sort((a, b) => b.weight - a.weight) };
}
