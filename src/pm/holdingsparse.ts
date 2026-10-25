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

export interface Quality { managers: { name: string; since: string | null }[]; aum: number | null; benchmark: string | null; expense: number | null; turnover: number | null; launch: string | null; exitLoad: string | null; exitLoadChanges: { from: string; note: string }[]; expenseChanges: { from: string; ratio: number }[] }
const num = (v: unknown) => { const n = typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
const istDay = (d: unknown) => typeof d !== 'string' || Number.isNaN(Date.parse(d)) ? null : d.endsWith('Z') ? new Date(Date.parse(d) + 5.5 * 3600000).toISOString().slice(0, 10) : d.slice(0, 10);
/** Fund quality facts from the same page (Engine Rules C-108). Facts only; the expense ratio history is kept as the dates on which it changed. */
export function parseQuality(html: string): Quality | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let j: any; try { j = JSON.parse(m[1]); } catch { return null; }
  const d = j?.props?.pageProps?.mfServerSideData; if (!d || typeof d !== 'object') return null;
  const managers = (Array.isArray(d.fund_manager_details) ? d.fund_manager_details : []).map((x: any) => ({ name: String(x?.person_name ?? '').trim(), since: istDay(x?.date_from) })).filter((x: { name: string }) => x.name);
  if (!managers.length && typeof d.fund_manager === 'string') for (const n of d.fund_manager.split(',')) if (n.trim()) managers.push({ name: n.trim(), since: null });
  const rows = (Array.isArray(d.historic_fund_expense) ? d.historic_fund_expense : []).map((x: any) => ({ day: istDay(x?.as_on_date), r: num(x?.expense_ratio) })).filter((x: { day: string | null; r: number | null }) => x.day && x.r != null).sort((a: { day: string }, b: { day: string }) => a.day.localeCompare(b.day)) as { day: string; r: number }[];
  const expenseChanges: Quality['expenseChanges'] = []; for (const x of rows) if (!expenseChanges.length || expenseChanges[expenseChanges.length - 1].ratio !== x.r) expenseChanges.push({ from: x.day, ratio: x.r });
  const exitLoadChanges = (Array.isArray(d.historic_exit_loads) ? d.historic_exit_loads : []).map((x: any) => ({ from: istDay(x?.as_on_date) ?? '', note: String(x?.note ?? '').trim() })).filter((x: { from: string; note: string }) => x.from && x.note).sort((a: { from: string }, b: { from: string }) => a.from.localeCompare(b.from));
  const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
  return { managers, aum: num(d.aum), benchmark: str(d.benchmark_name) ?? str(d.benchmark), expense: num(d.expense_ratio), turnover: num(d.portfolio_turnover), launch: str(d.launch_date), exitLoad: str(d.exit_load), exitLoadChanges, expenseChanges };
}
export interface QualityFlag { kind: string; text: string }
/** Flags are facts only: a lead manager under 12 months, and changes against the previous monthly snapshot. No threshold on size or turnover. */
export function qualityFlags(q: Quality, prev: Quality | null | undefined, today: string): QualityFlag[] {
  const f: QualityFlag[] = [], cut = new Date(Date.parse(today) - 365 * 86400000).toISOString().slice(0, 10);
  const lead = q.managers.filter((x) => x.since).sort((a, b) => (b.since as string).localeCompare(a.since as string))[0];
  if (lead && (lead.since as string) > cut) f.push({ kind: 'new-manager', text: `${lead.name} started managing it on ${lead.since}, under 12 months ago` });
  if (prev) {
    const a = new Set(prev.managers.map((x) => x.name)), b = new Set(q.managers.map((x) => x.name));
    for (const n of b) if (!a.has(n)) f.push({ kind: 'manager-added', text: `manager added since last month: ${n}` });
    for (const n of a) if (!b.has(n)) f.push({ kind: 'manager-left', text: `manager no longer listed since last month: ${n}` });
    if (prev.benchmark && q.benchmark && prev.benchmark !== q.benchmark) f.push({ kind: 'benchmark', text: `benchmark changed from ${prev.benchmark} to ${q.benchmark}` });
    if (prev.exitLoad && q.exitLoad && prev.exitLoad !== q.exitLoad) f.push({ kind: 'exit-load', text: 'exit load wording changed since last month' });
    if (prev.expense != null && q.expense != null && prev.expense !== q.expense) f.push({ kind: 'expense', text: `expense ratio changed from ${prev.expense}% to ${q.expense}%` });
  }
  return f;
}
