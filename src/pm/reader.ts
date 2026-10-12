// Any-platform order/tradebook reader (design section 11.1). Deterministic, no model call, no network.
// Input: rows of strings (from csv.ts or xlsx.ts). Output: normalised trades, the detected profile, identity found in the
// preamble (in memory only: the caller hashes it into an account alias and drops it), and issues.
import { createHmac } from 'node:crypto';

export type Side = 'buy' | 'sell';
export interface Trade {
  instrument: string; isin: string; side: Side; qty: number; price: number; value: number;
  date: string; time: string; exchange: string; orderId: string; tradeId: string; kind: 'stock' | 'fund' | 'unknown';
}
export interface Issue { row: number; reason: string }
export interface ReadResult {
  trades: Trade[]; issues: Issue[]; profile: { hash: string; headerRow: number; mapping: Record<string, string>; dateFormat: string };
  identity: { name?: string; clientCode?: string }; confidence: 'high' | 'low'; rejected?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SYN: Record<string, string[]> = {
  instrument: ['symbol', 'scrip', 'scrip name', 'stock name', 'security', 'security name', 'scheme', 'scheme name', 'instrument', 'name', 'company', 'trading symbol', 'fund name', 'ticker'],
  isin: ['isin', 'isin code', 'isin no'],
  side: ['type', 'trade type', 'side', 'buy sell', 'b s', 'transaction type', 'order type', 'action', 'txn type', 'buy or sell', 'transaction', 'purchase sale', 'purchase or sale', 'buy sale'],
  qty: ['quantity', 'qty', 'units', 'shares', 'no of units', 'traded qty', 'trade quantity'],
  price: ['price', 'rate', 'nav', 'average price', 'avg price', 'trade price', 'executed price', 'traded price'],
  value: ['value', 'amount', 'net amount', 'trade value', 'turnover', 'total', 'consideration', 'gross amount'],
  date: ['date', 'trade date', 'execution date', 'order date', 'execution date and time', 'order execution time', 'transaction date', 'date time', 'executed at', 'datetime'],
  time: ['time', 'order execution time', 'execution time', 'trade time'],
  orderId: ['order id', 'exchange order id', 'order no', 'order number', 'order ref', 'reference no'],
  tradeId: ['trade id', 'trade no', 'trade number', 'fill id', 'txn id'],
  exchange: ['exchange', 'exch', 'market'],
  status: ['order status', 'status'],
  segment: ['segment', 'series type', 'asset type', 'product type'],
};
const BUY = new Set(['buy', 'b', 'purchase', 'bought', 'subscription', 'switch in', 'sip', 'additional purchase', 'systematic investment', 'buy order']);
const SELL = new Set(['sell', 's', 'redemption', 'sold', 'switch out', 'redeem', 'withdrawal', 'sell order']);
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export const num = (s: string): number => {
  const t = s.replace(/[₹$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  return t === '' || !/^-?\d*\.?\d+(e-?\d+)?$/i.test(t) ? NaN : Number(t);
};

function fieldFor(header: string): string | null {
  const h = norm(header);
  for (const [f, list] of Object.entries(SYN)) if (list.includes(h)) return f;
  return null;
}

// ---- dates: decided on the whole column, never per row
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
interface DParts { a: number; b: number; c: number; kind: 'ymd' | 'xy' | 'mon' | 'serial'; time: string }
function splitDate(raw: string): DParts | null {
  const s = raw.trim();
  let m: RegExpExecArray | null;
  const time = (t?: string, ap?: string) => {
    if (!t) return '';
    let [h, mi, se] = t.split(':').map(Number);
    if (ap) { const pm = /p/i.test(ap); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(se || 0).padStart(2, '0')}`;
  };
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]+(\d{1,2}:\d{2}(?::\d{2})?)\s*([ap]m)?)?$/i.exec(s))) return { a: +m[1], b: +m[2], c: +m[3], kind: 'ymd', time: time(m[4], m[5]) };
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T ,]+(\d{1,2}:\d{2}(?::\d{2})?)\s*([ap]m)?)?$/i.exec(s))) return { a: +m[1], b: +m[2], c: +m[3], kind: 'xy', time: time(m[4], m[5]) };
  if ((m = /^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -,]*(\d{4})(?:[T ,]+(\d{1,2}:\d{2}(?::\d{2})?)\s*([ap]m)?)?$/i.exec(s))) {
    const mi = MON.indexOf(m[2].toLowerCase()); if (mi >= 0) return { a: +m[1], b: mi + 1, c: +m[3], kind: 'mon', time: time(m[4], m[5]) };
  }
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 25000 && +s < 70000) {
    const ms = Math.round((+s - 25569) * 86400000), d = new Date(ms);
    return { a: d.getUTCFullYear(), b: d.getUTCMonth() + 1, c: d.getUTCDate(), kind: 'serial', time: d.toISOString().slice(11, 19) === '00:00:00' ? '' : d.toISOString().slice(11, 19) };
  }
  return null;
}
export function parseDateColumn(raw: string[], hints: string[] = []): { iso: (string | null)[]; times: string[]; format: string } {
  const parts = raw.map((r) => (r.trim() ? splitDate(r) : null));
  const present = parts.filter((p): p is DParts => !!p);
  const xy = [...present, ...hints.map(splitDate).filter((p): p is DParts => !!p)].filter((p) => p.kind === 'xy');
  let order: 'dm' | 'md' = 'dm', fmt = present[0]?.kind ?? 'none';
  if (xy.length) {
    if (xy.some((p) => p.a > 12) && xy.some((p) => p.b > 12)) return { iso: raw.map(() => null), times: raw.map(() => ''), format: 'ambiguous' };
    if (xy.some((p) => p.b > 12)) order = 'md'; // second part exceeds 12 => month first
    else if (!xy.some((p) => p.a > 12)) {
      // nothing settles it by value; a broker file is in date order, so the reading that keeps the column sorted wins
      const seq = (o: 'dm' | 'md') => present.filter((p) => p.kind === 'xy').map((p) => (o === 'dm' ? p.c * 10000 + p.b * 100 + p.a : p.c * 10000 + p.a * 100 + p.b));
      const mono = (v: number[]) => v.every((x, i) => i === 0 || x >= v[i - 1]) || v.every((x, i) => i === 0 || x <= v[i - 1]);
      const dm = mono(seq('dm')), md = mono(seq('md'));
      if (md && !dm) order = 'md'; else if (!(dm && !md)) fmt = 'xy-assumed-day-first'; // still undecided: Indian default, flagged
    }
    if (fmt === 'xy') fmt = order === 'dm' ? 'dd-mm-yyyy' : 'mm-dd-yyyy';
  }
  const iso = parts.map((p) => {
    if (!p) return null;
    let y: number, mo: number, d: number;
    if (p.kind === 'xy') { [d, mo] = order === 'dm' ? [p.a, p.b] : [p.b, p.a]; y = p.c; } else if (p.kind === 'ymd') { y = p.a; mo = p.b; d = p.c; } else { y = p.kind === 'mon' ? p.c : p.a; mo = p.b; d = p.kind === 'mon' ? p.a : p.c; }
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  });
  return { iso, times: parts.map((p) => p?.time ?? ''), format: fmt };
}

// ---- header row scan and column mapping
function findHeader(rows: string[][]): { idx: number; fields: (string | null)[] } | null {
  let best: { idx: number; fields: (string | null)[]; score: number } | null = null;
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const fields = rows[i].map(fieldFor);
    const set = new Set(fields.filter(Boolean));
    const core = ['qty', 'side', 'date', 'instrument', 'isin', 'price', 'value'].filter((f) => set.has(f)).length;
    const score = set.size + core;
    if (set.size >= 3 && set.has('qty') && (!best || score > best.score)) best = { idx: i, fields, score };
  }
  return best;
}

function profileHash(headers: string[]): string {
  const s = headers.map(norm).join('|'); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

const idFrom = (rows: string[][], upTo: number) => {
  const out: { name?: string; clientCode?: string } = {};
  for (let i = 0; i < upTo; i++) {
    const [k, ...rest] = rows[i]; const v = rest.find((x) => x && x.trim());
    if (!k || !v) continue;
    if (/^name$/i.test(k.trim()) || /client name|account holder/i.test(k)) out.name = v.trim();
    if (/client code|client id|unique client|account (no|number)|demat|ucc/i.test(k)) out.clientCode = v.trim();
  }
  return out;
};

export function readRows(rows: string[][], opts: { filename?: string } = {}): ReadResult {
  const issues: Issue[] = [];
  const empty = (rejected: string): ReadResult => ({ trades: [], issues, profile: { hash: '', headerRow: -1, mapping: {}, dateFormat: '' }, identity: {}, confidence: 'low', rejected });
  const h = findHeader(rows);
  if (!h) return empty('No header row with a quantity column was found in the first 60 rows');
  const headers = rows[h.idx];
  const col: Record<string, number> = {};
  const mapping: Record<string, string> = {};
  h.fields.forEach((f, i) => { if (f && col[f] === undefined) { col[f] = i; mapping[f] = headers[i]; } });
  const body = rows.slice(h.idx + 1).map((r, i) => ({ r, n: h.idx + 2 + i }));
  const get = (r: string[], f: string) => (col[f] === undefined ? '' : (r[col[f]] ?? '').trim());
  // content-based rescue: an ISIN column whose header we did not recognise
  if (col.isin === undefined) {
    for (let c = 0; c < headers.length; c++) {
      const vals = body.map((b) => (b.r[c] ?? '').trim()).filter(Boolean);
      if (vals.length >= 3 && vals.filter((v) => ISIN_RE.test(v)).length / vals.length > 0.9) { col.isin = c; mapping.isin = headers[c] + ' (by content)'; break; }
    }
  }
  if (col.date === undefined) return empty('No date column');
  if (col.side === undefined) return empty('No buy/sell column');
  if (col.qty === undefined) return empty('No quantity column');
  if (col.price === undefined && col.value === undefined) return empty('Neither a price nor a value column');
  const hints = rows.slice(0, h.idx).flatMap((r) => r.join(' ').match(/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/g) ?? []);
  const dcol = parseDateColumn(body.map((b) => get(b.r, 'date')), hints);
  if (dcol.format === 'ambiguous') return empty('Date column mixes day-first and month-first values');
  const dateHasTime = dcol.times.some(Boolean);
  const trades: Trade[] = [];
  body.forEach((b, i) => {
    const r = b.r; const cells = r.filter((x) => x && x.trim());
    if (cells.length < 3) return; // footer / blank
    const status = get(r, 'status'); if (status && !/executed|complete|success|allot|confirmed/i.test(status)) return;
    const sideRaw = norm(get(r, 'side'));
    const side: Side | null = BUY.has(sideRaw) ? 'buy' : SELL.has(sideRaw) ? 'sell' : null;
    const iso = dcol.iso[i];
    const qty = num(get(r, 'qty')); let price = col.price !== undefined ? num(get(r, 'price')) : NaN; let value = col.value !== undefined ? num(get(r, 'value')) : NaN;
    if (!side) { issues.push({ row: b.n, reason: `Unknown buy/sell value "${get(r, 'side')}"` }); return; }
    if (!iso) { issues.push({ row: b.n, reason: `Unreadable date "${get(r, 'date')}"` }); return; }
    if (!(qty > 0)) { issues.push({ row: b.n, reason: `Quantity not a positive number "${get(r, 'qty')}"` }); return; }
    if (isNaN(price) && !isNaN(value)) price = value / qty;
    if (isNaN(value) && !isNaN(price)) value = price * qty;
    if (isNaN(price) || isNaN(value)) { issues.push({ row: b.n, reason: 'No usable price or value' }); return; }
    if (Math.abs(qty * price - value) > Math.max(1, value * 0.01)) { issues.push({ row: b.n, reason: `Quantity x price (${(qty * price).toFixed(2)}) does not match value (${value})` }); return; }
    const isin = get(r, 'isin').toUpperCase();
    const exch = get(r, 'exchange');
    const kind = /^(mf|fund)/i.test(get(r, 'segment')) ? 'fund' : exch ? 'stock' : isin || get(r, 'instrument') ? 'fund' : 'unknown'; // exchange-traded (shares, ETFs) carry an exchange; fund orders do not
    const time = (col.time !== undefined && col.time !== col.date ? get(r, 'time') : '') || dcol.times[i] || '';
    trades.push({ instrument: get(r, 'instrument'), isin, side, qty, price, value, date: iso, time, exchange: get(r, 'exchange').toUpperCase(), orderId: get(r, 'orderId'), tradeId: get(r, 'tradeId'), kind });
  });
  void dateHasTime;
  const identity = idFrom(rows, h.idx);
  const fromName = opts.filename ? /(?:^|[^A-Za-z0-9])([A-Z]{2}\d{4,}|\d{8,})(?:[^A-Za-z0-9]|$)/.exec(opts.filename)?.[1] : undefined;
  if (!identity.clientCode && fromName) identity.clientCode = fromName;
  const unmapped = headers.filter((x, i) => x.trim() && !h.fields[i]).length;
  const bad = body.length ? issues.length / body.length : 0;
  const confidence = bad < 0.02 && col.isin !== undefined && unmapped <= 3 && !dcol.format.includes('assumed') ? 'high' : 'low';
  if (!trades.length) return { ...empty('No valid rows'), issues };
  return { trades, issues, profile: { hash: profileHash(headers), headerRow: h.idx + 1, mapping, dateFormat: dcol.format }, identity, confidence };
}

// ---- merge, aggregate, alias
export function mergeTrades(batches: Trade[][]): { trades: Trade[]; duplicates: number } {
  const seen = new Set<string>(); const out: Trade[] = []; let dup = 0;
  for (const t of batches.flat()) {
    const k = t.tradeId ? `T|${t.tradeId}|${t.isin}|${t.side}` : `O|${t.orderId}|${t.isin}|${t.side}|${t.date}|${t.qty}|${t.value}`;
    const k2 = t.tradeId || t.orderId ? k : `X|${t.isin || t.instrument}|${t.side}|${t.date}|${t.time}|${t.qty}|${t.value}`;
    if (seen.has(k2)) { dup++; continue; } seen.add(k2); out.push(t);
  }
  return { trades: out, duplicates: dup };
}
// Fills sharing an order id (and date, side, instrument) become one order with a quantity-weighted price.
export function aggregateFills(trades: Trade[]): Trade[] {
  const map = new Map<string, Trade>(); const out: Trade[] = [];
  for (const t of trades) {
    if (!t.orderId) { out.push(t); continue; }
    const k = `${t.orderId}|${t.date}|${t.side}|${t.isin || t.instrument}`;
    const e = map.get(k);
    if (!e) { const c = { ...t, tradeId: '' }; map.set(k, c); out.push(c); } else { e.qty += t.qty; e.value += t.value; e.price = e.value / e.qty; }
  }
  return out;
}
export const accountAlias = (clientCode: string, salt: string): string => 'A' + createHmac('sha256', salt).update(clientCode.trim().toUpperCase()).digest('hex').slice(0, 8);
