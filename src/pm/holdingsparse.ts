// Read a fund's equity portfolio out of a fund page's embedded JSON (Engine Rules C-78). Pure: no network.
import type { PortfolioLine } from './lookthrough.ts';
const find = (v: unknown, key: string, depth = 0): unknown[] | null => {
  if (depth > 12 || !v || typeof v !== 'object') return null;
  if (!Array.isArray(v) && Array.isArray((v as Record<string, unknown>)[key])) return (v as Record<string, unknown[]>)[key];
  for (const x of Array.isArray(v) ? v : Object.values(v)) { const r = find(x, key, depth + 1); if (r) return r; }
  return null;
};
export interface Parsed { asOf: string | null; code: string | null; lines: PortfolioLine[] }
/** Equity lines only, as percent of the fund. Lines with a missing or non-positive weight are dropped; the same company on two lines is added together. */
export function parsePage(html: string): Parsed | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let j: unknown; try { j = JSON.parse(m[1]); } catch { return null; }
  const h = find(j, 'holdings'); if (!h) return null;
  const by = new Map<string, PortfolioLine>(); let asOf: string | null = null, code: string | null = null;
  for (const r of h as Record<string, unknown>[]) {
    if (String(r.nature_name ?? '').toUpperCase() !== 'EQUITY') continue;
    const w = Number(r.corpus_per), name = String(r.company_name ?? '').trim(); if (!(w > 0) || !name) continue;
    const d = typeof r.portfolio_date === 'string' ? r.portfolio_date : null;
    // the date is stored in UTC at 18:30 the evening before (IST midnight): shift to the Indian date
    if (d) { const ist = new Date(Date.parse(d) + 5.5 * 3600000).toISOString().slice(0, 10); if (!asOf || ist > asOf) asOf = ist; }
    if (!code && r.scheme_code != null) code = String(r.scheme_code);
    const o = by.get(name); if (o) o.weight += w; else by.set(name, { name, weight: w });
  }
  return { asOf, code, lines: [...by.values()].map((l) => ({ ...l, weight: Math.round(l.weight * 1000) / 1000 })).sort((a, b) => b.weight - a.weight) };
}
