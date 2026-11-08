// Filings loader step 3 (docs/FILINGS_LOADER_SPEC.md section 5, Engine Rules C-157): the as-of view of a company's quarterly results. Pure: facts in, view out.
// What it guarantees: nothing filed after t is ever returned; the original filing is used unless revisions are asked for; consolidated is used where filed, with a basis-break flag when the basis changes;
// year-on-year growth is not computed across a structure event until the year-ago quarter is itself on the new basis (five quarters counting the event quarter), nor across a basis difference;
// a missing field stays null, never 0.
import type { Values } from '../ingest/filings-parse.ts';
import type { StructureEvent } from '../ingest/entities.ts';

export interface ResultFact { entity: string; period: string; basis: 'consolidated' | 'standalone'; asOf: string; revision: number; fields: Values }
export type GrowthReason = 'ok' | 'no year-ago quarter' | 'basis differs' | 'structure event' | 'base not positive' | 'value missing';
export interface Growth { revenue: number | null; pbt: number | null; pat: number | null; eps: number | null }
export interface QuarterView { period: string; basis: 'consolidated' | 'standalone'; asOf: string; revision: number; values: Values; yoy: Growth | null; yoyReason: GrowthReason; basisBreak: boolean }
export interface View { entity: string; t: string; quarters: QuarterView[]; flags: Array<{ kind: 'structure event' | 'first consolidated filing'; date: string; detail: string }> }
export interface Opts { revisions?: boolean; limit?: number; events?: StructureEvent[] }

const NONE: Growth = { revenue: null, pbt: null, pat: null, eps: null };
const yearAgo = (p: string): string => `${Number(p.slice(0, 4)) - 1}${p.slice(4)}`;
/** The first quarter end on or after a date (quarter ends are 31 Mar, 30 Jun, 30 Sep, 31 Dec). */
export function quarterEndOnOrAfter(date: string): string {
  const y = Number(date.slice(0, 4)), md = date.slice(5);
  for (const e of ['03-31', '06-30', '09-30', '12-31']) if (md <= e) return `${y}-${e}`;
  return `${y}-12-31`;
}
const growth = (cur: number | null, prev: number | null): number | null | 'base' => { if (cur == null || prev == null) return null; if (!(prev > 0)) return 'base'; return cur / prev - 1; };

export function asOfResults(facts: ResultFact[], entity: string, t: string, o: Opts = {}): View {
  const known = facts.filter((f) => f.entity === entity && f.asOf.slice(0, 10) <= t);
  const periods = [...new Set(known.map((f) => f.period))].sort();
  // per period and basis: the original (lowest revision) or, when asked, the latest revision known at t
  const pick = (period: string, basis: 'consolidated' | 'standalone'): ResultFact | undefined => {
    const c = known.filter((f) => f.period === period && f.basis === basis).sort((a, b) => a.revision - b.revision);
    return c.length ? (o.revisions ? c[c.length - 1] : c[0]) : undefined;
  };
  const chosen = new Map<string, ResultFact>();
  for (const p of periods) { const f = pick(p, 'consolidated') ?? pick(p, 'standalone'); if (f) chosen.set(p, f); }
  const flags: View['flags'] = [];
  // a first consolidated filing after standalone-only history is a basis break at that quarter
  const order = [...chosen.keys()].sort(); let seenStandalone = false; const breaks = new Set<string>();
  for (const p of order) { const b = chosen.get(p)!.basis; if (b === 'standalone') seenStandalone = true; else if (seenStandalone && !breaks.size) { breaks.add(p); flags.push({ kind: 'first consolidated filing', date: p, detail: 'basis changes from standalone to consolidated' }); } }
  const evQ: string[] = []; for (const e of o.events ?? []) if (e.date <= t) { const q = quarterEndOnOrAfter(e.date); evQ.push(q); flags.push({ kind: 'structure event', date: e.date, detail: `${e.kind}: ${e.subject}` }); }
  for (const p of breaks) evQ.push(p);
  const views: QuarterView[] = order.map((p) => {
    const f = chosen.get(p)!; const ya = chosen.get(yearAgo(p));
    let reason: GrowthReason = 'ok', yoy: Growth | null = null;
    if (!ya) reason = 'no year-ago quarter';
    else if (ya.basis !== f.basis) reason = 'basis differs';
    else if (evQ.some((q) => q > yearAgo(p) && q <= p)) reason = 'structure event';   // the year-ago quarter must itself be on or after the event quarter
    if (reason === 'ok' && ya) {
      const g: Growth = { ...NONE }; let base = false, missing = false;
      for (const k of ['revenue', 'pbt', 'pat', 'eps'] as const) { const r = growth(f.fields[k], ya.fields[k]); if (r === 'base') { base = true; g[k] = null; } else { g[k] = r; if (r == null) missing = true; } }
      yoy = g; if (g.revenue == null && g.pbt == null && g.pat == null && g.eps == null) reason = base ? 'base not positive' : 'value missing';
    }
    return { period: p, basis: f.basis, asOf: f.asOf, revision: f.revision, values: f.fields, yoy: reason === 'ok' ? yoy : null, yoyReason: reason, basisBreak: breaks.has(p) };
  });
  const quarters = views.reverse().slice(0, o.limit ?? 12);
  return { entity, t, quarters, flags };
}
