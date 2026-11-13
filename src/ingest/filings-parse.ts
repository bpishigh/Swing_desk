// Filings loader (docs/FILINGS_LOADER_SPEC.md, C-157): turns one NSE integrated-filing XBRL results file into facts. Pure: text in, object out. No network, no clock.
// The format family is the header comment of the file (IFIndAs, IFNBFC, IFBanking, ...); the tag maps live in settings/filings-tags.json, never here.
// A field that cannot be read is absent (null), never 0.
export type Field = 'revenue' | 'pbt' | 'pat' | 'eps';
export interface TagMap { revenue: string[]; pbt: string[]; pat: string[]; eps: string[] }
export interface TagMaps { families: Record<string, TagMap>; aliases?: Record<string, string>; extras?: ExtraMaps }
export type Values = Record<Field, number | null>;
export interface ParsedResult {
  ok: true; family: string; viaAlias: string | null; inferred: boolean; basis: 'consolidated' | 'standalone' | null; symbol: string | null; scripCode: string | null;
  periodStart: string | null; periodEnd: string | null; ytdStart: string | null; boardMeeting: string | null; rounding: string | null; audited: string | null;
  quarter: Values; ytd: Values; missing: Field[];
  /** Batch A (A0): further figures from the same file, read through settings/filings-tags.json "extras". q = quarter income-statement lines (OneD), bs = balance sheet as at the period end (OneI), cf = cash flow for the year to date (FourD). Only figures that could be read are present (absent, never 0). */
  extra: Extra;
}
export type Extra = { q: Record<string, number>; bs: Record<string, number>; cf: Record<string, number> };
/** An extras entry is a list of alternatives tried in order; an alternative is one tag, or a list of tags that are added together (those present). */
export type ExtraMap = Record<string, (string | string[])[]>;
export interface ExtraMaps { q?: ExtraMap; bs?: ExtraMap; cf?: ExtraMap }
export interface ParseError { ok: false; error: string; family: string | null }
const FIELDS: Field[] = ['revenue', 'pbt', 'pat', 'eps'];
const NONE = (): Values => ({ revenue: null, pbt: null, pat: null, eps: null });

/** All facts of one context: tag name -> text. Only plain facts (the contextRef must be exactly the quarter or the year-to-date context, which carry no dimension). */
function factsOf(xml: string, ctx: string): Map<string, string> {
  const m = new Map<string, string>();
  const re = new RegExp(`<in-[\\w-]+:(\\w+)\\b([^>]*)contextRef="${ctx}"([^>]*)>([^<]*)<`, 'g');
  for (const x of xml.matchAll(re)) { if (/xsi:nil="true"/.test(x[2] + x[3])) continue; const v = x[4].trim(); if (v !== '' && !m.has(x[1])) m.set(x[1], v); }
  return m;
}
const num = (s: string | undefined): number | null => { if (s == null) return null; const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
function pick(f: Map<string, string>, tags: string[]): number | null { for (const t of tags) { const n = num(f.get(t)); if (n != null) return n; } return null; }

function readExtras(f: Map<string, string>, map: ExtraMap | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, alts] of Object.entries(map ?? {})) {
    for (const a of alts) {
      const tags = Array.isArray(a) ? a : [a]; const vals = tags.map((t) => num(f.get(t))).filter((v): v is number => v != null);
      if (vals.length) { out[k] = vals.reduce((x, y) => x + y, 0); break; }
    }
  }
  return out;
}

/** Older files (in-bse-fin taxonomy, before the integrated filing) carry no header comment. The family is then read from which profit and income tags the quarter holds, never from the file name. Same four maps as the newer families. */
export function inferFamily(q: Map<string, string>): string | null {
  const has = (t: string) => q.has(t);
  if (has('ProfitLossFromOrdinaryActivitiesBeforeTax') || has('RevenueOnInvestments')) return 'IFBanking';
  if (has('ProfitLossBeforeTax') && has('ProfitLossAfterTaxAndExtraordinaryItems')) return 'IFLI';
  if (has('RevenueFromOperations') && has('ProfitBeforeTax') && has('ProfitLossForPeriod')) return 'IFIndAs';
  if (has('RevenueFromOperations') && has('ProfitBeforeTax') && has('ProfitLossForThePeriod')) return 'IFOTB';
  return null;
}

export function parseResultsXbrl(xml: string, maps: TagMaps): ParsedResult | ParseError {
  const q = factsOf(xml, 'OneD'), y = factsOf(xml, 'FourD'), b = factsOf(xml, 'OneI');
  const stated = (xml.match(/<!--\s*(\w+)/) || [])[1] ?? null;
  const known = stated != null && (maps.families[stated] != null || maps.aliases?.[stated] != null);
  const family = known ? stated : (q.size ? inferFamily(q) : null) ?? stated;
  if (!family) return { ok: false, error: q.size ? 'no format family in the header comment and none inferable from the tags' : 'no format family in the header comment', family };
  const inferred = !known;
  const via = maps.families[family] ? null : maps.aliases?.[family] ?? null;
  const map = maps.families[family] ?? (via ? maps.families[via] : undefined);
  if (!map) return { ok: false, error: `no tag map for family ${family}`, family };
  if (q.size === 0) return { ok: false, error: 'no quarter context (OneD) facts', family };
  const nature = (q.get('NatureOfReportStandaloneConsolidated') || '').toLowerCase();
  const quarter = NONE(), ytd = NONE();
  for (const k of FIELDS) { quarter[k] = pick(q, map[k]); ytd[k] = pick(y, map[k]); }
  return {
    ok: true, family, viaAlias: via, inferred, basis: nature.startsWith('consolidated') ? 'consolidated' : nature.startsWith('standalone') ? 'standalone' : null,
    symbol: q.get('Symbol') ?? null, scripCode: q.get('ScripCode') ?? null, periodStart: q.get('DateOfStartOfReportingPeriod') ?? null, periodEnd: q.get('DateOfEndOfReportingPeriod') ?? null,
    ytdStart: y.get('DateOfStartOfReportingPeriod') ?? null, boardMeeting: q.get('DateOfBoardMeetingWhenFinancialResultsWereApproved') ?? null, rounding: q.get('LevelOfRounding') ?? null, audited: q.get('WhetherResultsAreAuditedOrUnaudited') ?? null,
    quarter, ytd, missing: FIELDS.filter((k) => quarter[k] == null),
    extra: { q: readExtras(q, maps.extras?.q), bs: readExtras(b, maps.extras?.bs), cf: readExtras(y, maps.extras?.cf) },
  };
}
