// Dividends computed from public data (design 7.4): entitlement = units held at the close before the ex-date x declared per-share amount.
// Labelled "computed": an entitlement, not proof that cash arrived. A broker or bank report, if ever uploaded, replaces the computed line.
import { replay, keyOf, type CorpEvent } from './ledger.ts';
import type { Trade } from './reader.ts';
import type { FeedRow } from './nse-catalogue.ts';
import type { Lineage } from './lineage.ts';
import { fy } from './tax.ts';
type DivRules = typeof import('../../data/rules/dividend.json');

export interface DividendLine { key: string; symbol: string; exDate: string; fy: string; units: number; perShare: number; gross: number; tds: number; net: number; confidence: string; computed: true }
export interface DividendYear { fy: string; gross: number; tds: number; net: number; lines: DividendLine[] }

export const perShareAmount = (subject: string): number | null => {
  if (!/dividend/i.test(subject)) return null;
  let sum = 0, found = false;
  for (const m of subject.matchAll(/R[se]\.?\s*([\d,]+(?:\.\d+)?)\s*(?:\/-)?\s*Per\s*Share/gi)) { sum += Number(m[1].replace(/,/g, '')); found = true; }
  return found ? sum : null;
};

export function computeDividends(trades: Trade[], events: CorpEvent[], feed: FeedRow[], lin: Lineage, rules: DivRules, longAfterDays: number | null = 365): DividendYear[] {
  const keys = new Set(trades.filter((t) => t.kind !== 'fund').map((t) => keyOf(t)));
  const rows = feed.map((r) => ({ r, key: lin.key(r.symbol, r.isin), amt: perShareAmount(r.subject) })).filter((x) => x.amt !== null && keys.has(x.key));
  const dates = [...new Set(rows.map((x) => x.r.exDate))].sort();
  const heldAt = new Map<string, Map<string, number>>();                                  // exDate -> key -> units at the close before
  for (const d of dates) {
    const rep = replay(trades.filter((t) => t.date < d), longAfterDays, events.filter((e) => e.date < d));
    const m = new Map<string, number>(); for (const l of rep.open) m.set(l.key, (m.get(l.key) ?? 0) + l.qty); heldAt.set(d, m);
  }
  const lines: DividendLine[] = [];
  for (const x of rows) {
    const units = heldAt.get(x.r.exDate)?.get(x.key) ?? 0; if (units <= 0) continue;
    const gross = Math.round(units * x.amt! * 100) / 100;
    lines.push({ key: x.key, symbol: x.r.symbol, exDate: x.r.exDate, fy: fy(x.r.exDate), units, perShare: x.amt!, gross, tds: 0, net: gross, confidence: 'High on amount and date, Medium on the net credited', computed: true });
  }
  // TDS: per company per financial year, applied when the year's dividends from that company pass the threshold (on the whole amount, as the Act does)
  const byCo = new Map<string, DividendLine[]>();
  for (const l of lines) (byCo.get(`${l.key}|${l.fy}`) ?? byCo.set(`${l.key}|${l.fy}`, []).get(`${l.key}|${l.fy}`)!).push(l);
  for (const g of byCo.values()) {
    const total = g.reduce((a, l) => a + l.gross, 0);
    for (const l of g) { const rule = rules.tds.find((t) => t.from <= l.exDate && l.exDate <= t.to); if (rule && total > rule.threshold) { l.tds = Math.round(l.gross * rule.rate * 100) / 100; l.net = Math.round((l.gross - l.tds) * 100) / 100; } }
  }
  const years = new Map<string, DividendYear>();
  for (const l of lines.sort((a, b) => a.exDate.localeCompare(b.exDate))) {
    const y = years.get(l.fy) ?? years.set(l.fy, { fy: l.fy, gross: 0, tds: 0, net: 0, lines: [] }).get(l.fy)!;
    y.gross += l.gross; y.tds += l.tds; y.net += l.net; y.lines.push(l);
  }
  return [...years.values()].sort((a, b) => a.fy.localeCompare(b.fy)).map((y) => ({ ...y, gross: Math.round(y.gross), tds: Math.round(y.tds), net: Math.round(y.net) }));
}
