// NSE exchange circulars that announce a face-value split (equity or ETF unit split) or an ISIN change for a sub-division.
// The circular is the exchange's own record: it names the symbol, the old and new face value and the effective (ex) date.
// The price factor is new/old (Rs 10 to Re 1 gives 0.1). Applied only where a price break sits on the effective date.

export interface CircularItem { symbol: string; from: number; to: number }
export interface ParsedCircular { no: string; effective: string; items: CircularItem[] }

const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

const STOP = new Set(['ETF', 'ETFS', 'FUND', 'LTD', 'LIMITED', 'ISIN', 'NSE', 'INDIA', 'INDEX', 'BSE', 'NIFTY', 'EXCHANGE', 'TRADED']);

/** Subjects worth downloading. */
export function wantedSubject(sub: string): boolean { return /face value split|sub-?division|change in isin/i.test(sub); }

export function effectiveDate(text: string): string | null {
  const t = text.replace(/\s+/g, ' ');
  const m = /(?:w\.e\.f\.?|effective from|ex-date i\.e\.,?)\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i.exec(t);
  const mo = m && MONTHS[m[1].toLowerCase()];
  return m && mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

/**
 * Read the symbols and face values from a circular's text.
 * `universe`: every symbol that trades. `prefer`: symbols with a price break (used to pick the right token when a row has several capitalised words).
 * Returns null when the text is not a split or sub-division notice; items is empty when it is one but could not be read.
 */
export function parseCircularText(text: string, no: string, universe: Set<string>, prefer: Set<string> = new Set()): ParsedCircular | null {
  const t = text.replace(/\|/g, ' ').replace(/\s+/g, ' ');
  const effective = effectiveDate(t);
  const isIsin = /change in isin/i.test(t);
  const isSplit = /face value split/i.test(t);
  if (!isIsin && !isSplit) return null;
  const events: Array<{ at: number; end: number; from: number; to: number }> = [];
  let start = 0, stop = t.length;
  if (isIsin) {
    const re = /Sub-?\s?Division from Rs\.?\s*([\d.]+)\s*\/?-?\s*to\s*Re\.?\s*([\d.]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) events.push({ at: m.index, end: m.index + m[0].length, from: Number(m[1]), to: Number(m[2]) });
    if (!events.length) return null;   // an ISIN change for some other reason
  } else {
    const s = /Sr\.?\s*No\.?/i.exec(t); if (s) start = s.index;
    const e = /This circular|For and on behalf/i.exec(t.slice(start)); if (e) stop = start + e.index;
    const body = t.slice(start, stop);
    const re = /(?<![\w./])(\d{1,4}(?:\.\d+)?) (?=(\d{1,3}(?:\.\d+)?)(?![\w./]))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const from = Number(m[1]), to = Number(m[2]);
      if (from > to && to > 0) events.push({ at: start + m.index, end: start + m.index + m[0].length + m[2].length, from, to });
    }
  }
  const items: CircularItem[] = [];
  let cursor = start;
  for (const ev of events) {
    const seg = t.slice(cursor, ev.at);
    const toks = [...seg.matchAll(/\b[A-Z][A-Z0-9&-]{2,19}\b/g)].map((x) => x[0]).filter((x) => universe.has(x) && !STOP.has(x));
    const pref = toks.filter((x) => prefer.has(x));
    const symbol = pref.length ? pref[pref.length - 1] : toks[toks.length - 1];
    if (symbol && !items.some((i) => i.symbol === symbol)) items.push({ symbol, from: ev.from, to: ev.to });
    cursor = ev.end;
  }
  return { no, effective: effective ?? '', items: effective ? items : [] };
}
