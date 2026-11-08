// Filings loader step 2 (docs/FILINGS_LOADER_SPEC.md section 4, C-157 rule 4): the entity table. Pure: lists in, table out. No network, no clock.
// A company's entity id is created once and never changes; a ticker is only an attribute. Links come from NSE's official symbol-change list (authority), never from price continuity.
// Anything that does not fit cleanly (a symbol that traded after its change date, a new symbol already in use, a symbol taken again after it was freed) goes on a review list and is never merged silently.
export interface Span { first: string; last: string }
export interface SymbolChange { name?: string; oldSymbol: string; newSymbol: string; date: string }
export interface NameChange { symbol: string; oldName: string; newName: string; date: string }
export interface CorpAction { symbol: string; subject: string; exDate: string; isin?: string }
export interface SymbolUse { symbol: string; from: string | null; to: string | null }
export type EventKind = 'demerger' | 'scheme';
export interface StructureEvent { date: string; kind: EventKind; symbol: string; subject: string; isin: string | null }
export interface Entity { id: string; symbols: SymbolUse[]; names: Array<{ name: string; from: string | null }>; events: StructureEvent[]; firstSeen: string | null; lastSeen: string | null; status: 'active' | 'vanished' }
export interface ReviewItem { kind: 'new symbol already in use' | 'old symbol traded after the change date' | 'new symbol traded before the change date' | 'symbol taken again after it was freed'; symbol: string; other?: string; date: string; detail: string }
export interface EntityTable { asOf: string; entities: Entity[]; review: ReviewItem[]; counts: { entities: number; linked: number; vanished: number; events: number; review: number } }

const day = (d: string, n: number): string => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const TOLERANCE_DAYS = 7;
export const eventKind = (subject: string): EventKind | null => {
  const s = subject.trim().toLowerCase();
  if (/de-?merger/.test(s)) return 'demerger';
  if (/scheme of (arrangement|amalgamation|arangement)|composite scheme|merger/.test(s) && !/bonus|dividend|distribution|interest/.test(s)) return 'scheme';
  return null;
};

export function buildEntities(i: { spans: Record<string, Span>; symbolChanges: SymbolChange[]; nameChanges: NameChange[]; actions: CorpAction[]; asOf: string; vanishedAfterDays?: number }): EntityTable {
  const eq = (s: string) => Object.prototype.hasOwnProperty.call(i.spans, s);
  const ents: Entity[] = [], owner = new Map<string, Entity>(), review: ReviewItem[] = [], freed = new Set<string>();
  const make = (symbol: string, from: string | null): Entity => {
    const sp = i.spans[symbol]; let id = symbol; if (ents.some((e) => e.id === id)) id = `${symbol}~${(from ?? sp?.first ?? '0000').slice(0, 4)}`;
    const e: Entity = { id, symbols: [{ symbol, from: from ?? sp?.first ?? null, to: null }], names: [], events: [], firstSeen: sp?.first ?? null, lastSeen: sp?.last ?? null, status: 'active' };
    ents.push(e); owner.set(symbol, e); return e;
  };
  const changes = i.symbolChanges.filter((c) => eq(c.oldSymbol) || eq(c.newSymbol)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let linked = 0;
  for (const c of changes) {
    if (c.oldSymbol === c.newSymbol) continue;
    const sn0 = i.spans[c.newSymbol];
    if (sn0 && sn0.first < day(c.date, -TOLERANCE_DAYS)) { review.push({ kind: 'new symbol traded before the change date', symbol: c.newSymbol, other: c.oldSymbol, date: c.date, detail: `${c.newSymbol} first traded ${sn0.first}, so it is not linked to ${c.oldSymbol}` }); continue; }
    const cur = owner.get(c.oldSymbol) ?? make(c.oldSymbol, null);
    const occupied = owner.get(c.newSymbol);
    if (occupied && occupied !== cur) { review.push({ kind: 'new symbol already in use', symbol: c.oldSymbol, other: c.newSymbol, date: c.date, detail: `${c.newSymbol} already belongs to ${occupied.id}` }); continue; }
    if (freed.has(c.newSymbol) && !occupied) review.push({ kind: 'symbol taken again after it was freed', symbol: c.newSymbol, other: c.oldSymbol, date: c.date, detail: `${c.newSymbol} was freed by an earlier change and is now taken by ${cur.id}` });
    const so = i.spans[c.oldSymbol], sn = sn0;
    if (so && so.last > day(c.date, TOLERANCE_DAYS)) review.push({ kind: 'old symbol traded after the change date', symbol: c.oldSymbol, other: c.newSymbol, date: c.date, detail: `${c.oldSymbol} last traded ${so.last}` });
    const last = cur.symbols[cur.symbols.length - 1]; last.to = day(c.date, -1);
    cur.symbols.push({ symbol: c.newSymbol, from: c.date, to: null }); owner.delete(c.oldSymbol); freed.add(c.oldSymbol); owner.set(c.newSymbol, cur); linked++;
    if (sn) cur.lastSeen = sn.last;
  }
  for (const s of Object.keys(i.spans)) if (!owner.has(s) && !ents.some((e) => e.symbols.some((u) => u.symbol === s))) make(s, null);
  // the symbol in force on a date
  const entityOn = (symbol: string, date: string): Entity | undefined => ents.find((e) => e.symbols.some((u) => u.symbol === symbol && (u.from == null || u.from <= date) && (u.to == null || u.to >= date))) ?? ents.find((e) => e.symbols.some((u) => u.symbol === symbol));
  for (const n of [...i.nameChanges].sort((a, b) => (a.date < b.date ? -1 : 1))) { const e = entityOn(n.symbol, n.date); if (!e) continue; if (!e.names.length) e.names.push({ name: n.oldName, from: e.firstSeen }); e.names.push({ name: n.newName, from: n.date }); }
  let events = 0;
  for (const a of i.actions) { const k = eventKind(a.subject); if (!k || !eq(a.symbol)) continue; const e = entityOn(a.symbol, a.exDate); if (!e) continue; if (e.events.some((x) => x.date === a.exDate && x.kind === k && x.symbol === a.symbol)) continue; e.events.push({ date: a.exDate, kind: k, symbol: a.symbol, subject: a.subject.trim(), isin: a.isin ?? null }); events++; }
  const cutoff = day(i.asOf, -(i.vanishedAfterDays ?? 30));
  for (const e of ents) { e.events.sort((a, b) => (a.date < b.date ? -1 : 1)); const ls = e.lastSeen; if (ls && ls < cutoff) e.status = 'vanished'; }
  return { asOf: i.asOf, entities: ents, review, counts: { entities: ents.length, linked, vanished: ents.filter((e) => e.status === 'vanished').length, events, review: review.length } };
}
