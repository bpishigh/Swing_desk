// India index feed: parse NSE's official index close file, keep a history of closes, compute what the desk needs.
// Pure functions, no I/O. Definitions follow the India nightly prompt (STEP 2 and 3) that the Claude Desk uses today:
//   sma50 / sma200 = mean of the last 50 / 200 stored closes through the session BEFORE D (omitted when fewer exist);
//   r1m / r3m      = close on D against the last stored close on or before the same calendar day 1 / 3 months earlier.
import { returnOver } from '../engine/indicators.ts';

/** Desk key -> names the NSE file may use (compared after normalise()). The first entry is the one we expect. */
export const INDIA_INDICES: Record<string, string[]> = {
  'Nifty 50': ['Nifty 50'],
  'Nifty 500': ['Nifty 500'],
  'Nifty IT': ['Nifty IT'],
  'Nifty Bank': ['Nifty Bank'],
  'Nifty Financial Services': ['Nifty Financial Services', 'Nifty Fin Service'],
  'Nifty PSU Bank': ['Nifty PSU Bank'],
  'Nifty Auto': ['Nifty Auto'],
  'Nifty Pharma': ['Nifty Pharma'],
  'Nifty FMCG': ['Nifty FMCG'],
  'Nifty Metal': ['Nifty Metal'],
  'Nifty Realty': ['Nifty Realty'],
  'Nifty Energy': ['Nifty Energy'],
  'Nifty Infrastructure': ['Nifty Infrastructure', 'Nifty Infra'],
  'Nifty PSE': ['Nifty PSE'],
  'Nifty Media': ['Nifty Media'],
  'Nifty India Defence': ['Nifty India Defence', 'Nifty Ind Defence'],
  'Nifty Healthcare': ['Nifty Healthcare Index', 'Nifty Healthcare'],
  'Nifty Oil & Gas': ['Nifty Oil & Gas', 'Nifty Oil and Gas'],
  'Nifty Consumer Durables': ['Nifty Consumer Durables', 'Nifty Consr Durbl'],
  'Nifty Chemicals': ['Nifty Chemicals'],
  'Nifty Capital Markets': ['Nifty Capital Markets', 'Nifty Capital Mkt'],
};
export const SECTORS = Object.keys(INDIA_INDICES).filter((k) => k !== 'Nifty 50' && k !== 'Nifty 500');
export const VIX_NAMES = ['India VIX'];

export const normalise = (s: string): string =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/\bindex\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

export interface IndexRow { name: string; open: number | null; high: number | null; low: number | null; close: number; volume: number | null }
export interface IndexDay { date: string; rows: IndexRow[] }

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const t = s.replace(/,/g, '').trim();
  if (t === '' || t === '-') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};

/** Split one CSV line, honouring double quotes. */
export function splitLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/**
 * Parse ind_close_all_DDMMYYYY.csv. The date comes from the "Index Date" column inside the file (DD-MM-YYYY), never from the
 * file name. All rows must carry one date; otherwise this throws, so a mixed or wrong-day file cannot reach the history.
 */
export function parseIndexCloseCsv(text: string): IndexDay {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('index close file has no data rows');
  const head = splitLine(lines[0]).map((h) => h.toLowerCase());
  const col = (re: RegExp): number => { const i = head.findIndex((h) => re.test(h)); if (i < 0) throw new Error(`index close file: no column matching ${re}`); return i; };
  const iName = col(/^index name/), iDate = col(/^index date/), iOpen = col(/^open/), iHigh = col(/^high/), iLow = col(/^low/), iClose = col(/^clos/), iVol = col(/^volume/);
  const dates = new Set<string>(); const rows: IndexRow[] = [];
  for (const line of lines.slice(1)) {
    const f = splitLine(line);
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(f[iDate] ?? '');
    if (!m) continue;
    const close = num(f[iClose]);
    if (close === null) continue;
    dates.add(`${m[3]}-${m[2]}-${m[1]}`);
    rows.push({ name: f[iName], open: num(f[iOpen]), high: num(f[iHigh]), low: num(f[iLow]), close, volume: num(f[iVol]) });
  }
  if (dates.size !== 1) throw new Error(`index close file carries ${dates.size} dates (${[...dates].join(', ')}), expected one`);
  return { date: [...dates][0], rows };
}

/** Find a desk index in a parsed day. Returns undefined when the file does not carry it. */
export function findIndex(day: IndexDay, names: string[]): IndexRow | undefined {
  const want = names.map(normalise);
  return day.rows.find((r) => want.includes(normalise(r.name)));
}

export type Closes = Record<string, Record<string, number>>;
export interface CloseStore { asOf: string; closes: Closes; note?: string }

export interface MergeResult { store: CloseStore; added: string[]; missing: string[]; conflicts: string[] }

/**
 * Add one day's closes to the history. A date already stored is never overwritten: a different value is reported as a conflict
 * and the stored one kept (the history is the source of truth for averages).
 */
export function mergeDay(store: CloseStore, day: IndexDay): MergeResult {
  const closes: Closes = JSON.parse(JSON.stringify(store.closes));
  const added: string[] = [], missing: string[] = [], conflicts: string[] = [];
  for (const [key, names] of Object.entries(INDIA_INDICES)) {
    const row = findIndex(day, names);
    if (!row) { missing.push(key); continue; }
    const h = (closes[key] ??= {});
    if (day.date in h) { if (Math.abs(h[day.date] - row.close) > 0.005) conflicts.push(`${key}: stored ${h[day.date]}, file ${row.close}`); continue; }
    h[day.date] = row.close; added.push(key);
  }
  return { store: { ...store, closes, asOf: day.date > store.asOf ? day.date : store.asOf }, added, missing, conflicts };
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Mean of the last n stored closes dated before `date`; NaN when fewer than n exist. */
export function smaBefore(h: Record<string, number>, date: string, n: number): number {
  const ds = Object.keys(h).filter((d) => d < date).sort();
  if (ds.length < n) return NaN;
  let s = 0; for (const d of ds.slice(-n)) s += h[d];
  return s / n;
}
/** The session the averages run through: the last stored date before `date`. */
export const maAsOf = (h: Record<string, number>, date: string): string | null => {
  const ds = Object.keys(h).filter((d) => d < date).sort(); return ds.length ? ds[ds.length - 1] : null;
};

export interface IndexStats { close: number; date: string; sma50?: number; sma200?: number; r1m?: number; r3m?: number; maAsOf: string | null }

export function indexStats(h: Record<string, number>, date: string): IndexStats | null {
  const close = h[date];
  if (typeof close !== 'number') return null;
  const s50 = smaBefore(h, date, 50), s200 = smaBefore(h, date, 200);
  const r1 = returnOver(h, date, 1), r3 = returnOver(h, date, 3);
  const out: IndexStats = { close, date, maAsOf: maAsOf(h, date) };
  if (!Number.isNaN(s50)) out.sma50 = round2(s50);
  if (!Number.isNaN(s200)) out.sma200 = round2(s200);
  if (!Number.isNaN(r1)) out.r1m = r1;
  if (!Number.isNaN(r3)) out.r3m = r3;
  return out;
}

export interface FeedSector { close: number; date: string; sma50?: number; sma200?: number; r1m?: number; r3m?: number; src: string }
export interface IndiaFeed {
  date: string; fetchedAt: string;
  bench: { r1m?: number; r3m?: number };
  sectors: Record<string, FeedSector>;
  flags: string[];
}

/** The feed document for date D from the stored history. A sector with no close dated D is left out and flagged. */
export function buildFeed(store: CloseStore, date: string, fetchedAt: string, src: string): IndiaFeed {
  const flags: string[] = [];
  const sectors: Record<string, FeedSector> = {};
  for (const k of SECTORS) {
    const st = store.closes[k] ? indexStats(store.closes[k], date) : null;
    if (!st) { flags.push(`${k}: no close dated ${date}`); continue; }
    const { maAsOf: _m, ...rest } = st;
    sectors[k] = { ...rest, src };
    if (st.sma200 === undefined) flags.push(`${k}: fewer than 200 stored closes, 200 SMA omitted`);
  }
  const b = store.closes['Nifty 50'] ? indexStats(store.closes['Nifty 50'], date) : null;
  const bench: IndiaFeed['bench'] = {};
  if (b?.r1m !== undefined) bench.r1m = b.r1m;
  if (b?.r3m !== undefined) bench.r3m = b.r3m;
  if (!b) flags.push(`Nifty 50: no close dated ${date}`);
  return { date, fetchedAt, bench, sectors, flags };
}

export interface TrackerRow {
  date: string; close: number; high: number | null; low: number | null; volume: number | null;
  sma50?: number; sma200?: number; maAsOf: string | null; vix?: number;
  b?: { close: number; sma50?: number; sma200?: number };
  src: string; fetchedAt: string; flags: string[];
}

/** The benchmark row for date D. Volume from the NSE file is in shares and is stored in millions. */
export function buildTracker(store: CloseStore, day: IndexDay, fetchedAt: string, src: string): TrackerRow | null {
  const n50 = findIndex(day, INDIA_INDICES['Nifty 50']);
  const h50 = store.closes['Nifty 50'];
  if (!n50 || !h50) return null;
  const st = indexStats(h50, day.date);
  if (!st) return null;
  const flags: string[] = [];
  const row: TrackerRow = {
    date: day.date, close: n50.close, high: n50.high, low: n50.low,
    volume: n50.volume === null ? null : round2(n50.volume / 1e6),
    maAsOf: st.maAsOf, src, fetchedAt, flags,
  };
  if (st.sma50 !== undefined) row.sma50 = st.sma50;
  if (st.sma200 !== undefined) row.sma200 = st.sma200;
  if (row.volume === null) flags.push('volume missing in the NSE file');
  else flags.push('volume from the NSE index close file (shares, shown in millions); basis versus Investing.com not confirmed');
  const vix = findIndex(day, VIX_NAMES); if (vix) row.vix = vix.close; else flags.push('India VIX not in the NSE file');
  const n500 = store.closes['Nifty 500'] ? indexStats(store.closes['Nifty 500'], day.date) : null;
  if (n500) { row.b = { close: n500.close }; if (n500.sma50 !== undefined) row.b.sma50 = n500.sma50; if (n500.sma200 !== undefined) row.b.sma200 = n500.sma200; }
  else flags.push('Nifty 500 close missing');
  return row;
}

/** Sanity check against the previous stored close: a move beyond `pct` percent is reported, not silently accepted. */
export function jumpFlags(store: CloseStore, date: string, pct = 12): string[] {
  const out: string[] = [];
  for (const [k, h] of Object.entries(store.closes)) {
    const prev = maAsOf(h, date); if (!prev || typeof h[date] !== 'number') continue;
    const mv = (h[date] / h[prev] - 1) * 100;
    if (Math.abs(mv) > pct) out.push(`${k}: ${round2(mv)}% move from ${prev} to ${date}`);
  }
  return out;
}
