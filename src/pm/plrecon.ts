// Realised-gains check: the broker's profit-and-loss statement for a financial year against the gains the tradebook produces (design section 11, phase 4).
// A difference points at a missing buy (the cost is then wrong), a corporate action, or an opening position the tradebook never saw.
import { num } from './reader.ts';
import type { CgRow } from './cgexport.ts';
import { fy as fyOf } from './tax.ts';

export interface PnlLine { isin: string; name: string; qty: number; sell: number; pnl: number; sellDate: string | null }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SYN = {
  isin: ['isin', 'isin code'],
  name: ['stock name', 'scheme name', 'security name', 'scrip name', 'instrument', 'name', 'company name', 'symbol', 'fund name', 'scrip'],
  qty: ['quantity', 'qty', 'units', 'sell quantity', 'sold quantity'],
  sell: ['selling value', 'sell value', 'sale value', 'sell amount', 'sale amount', 'sale proceeds', 'sell proceeds', 'total sell value', 'sale consideration', 'redemption value'],
  pnl: ['realised p l', 'realized p l', 'realised pnl', 'realized pnl', 'realised profit', 'realized profit', 'profit loss', 'p l', 'pnl', 'net p l', 'profit', 'gain loss', 'realised gain loss', 'realized gain loss'],
  date: ['sell date', 'sale date', 'date of sale', 'sold on', 'redemption date', 'sell dt'],
};
const pick = (h: string[], list: string[]) => h.findIndex((x) => list.includes(norm(x)));
const iso = (s: string): string | null => { const t = s.trim(); let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };

/** The header row has a quantity, a sale value and a profit column; each row below is a lot or an instrument. */
export function readPnl(rows: string[][]): { lines: PnlLine[]; headerRow: number; hasDates: boolean } | null {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const h = rows[i].map((c) => String(c ?? '')), qi = pick(h, SYN.qty), si = pick(h, SYN.sell), pi = pick(h, SYN.pnl), ii = pick(h, SYN.isin), ni = pick(h, SYN.name), di = pick(h, SYN.date);
    if (qi < 0 || si < 0 || pi < 0 || (ii < 0 && ni < 0)) continue;
    const lines: PnlLine[] = [];
    for (const r of rows.slice(i + 1)) {
      const q = num(String(r[qi] ?? '')), s = num(String(r[si] ?? '')), p = num(String(r[pi] ?? '')); if (!(q > 0) || !Number.isFinite(s) || !Number.isFinite(p)) continue;
      const isin = ii >= 0 ? String(r[ii] ?? '').trim().toUpperCase() : '';
      lines.push({ isin: ISIN.test(isin) ? isin : '', name: ni >= 0 ? String(r[ni] ?? '').trim() : '', qty: q, sell: s, pnl: p, sellDate: di >= 0 ? iso(String(r[di] ?? '')) : null });
    }
    if (lines.length) return { lines, headerRow: i, hasDates: di >= 0 && lines.some((l) => l.sellDate) };
  }
  return null;
}

export interface PnlRow { name: string; isin: string; stmtSell: number | null; ledgerSell: number | null; stmtPnl: number | null; ledgerPnl: number | null; status: 'match' | 'differs' | 'only-statement' | 'only-ledger'; why: string }
export interface PnlRecon { fy: string; rows: PnlRow[]; matched: number; differ: number; onlyStatement: number; onlyLedger: number; stmtTotal: number; ledgerTotal: number; verified: boolean }

/** The ledger's gain is after deductible charges; the statement's is before, so the charges are added back. Allowed gap: ₹5 or 0.5% of the sale value. */
export function reconcilePnl(lines: PnlLine[], cg: CgRow[], fy: string): PnlRecon {
  const key = (isin: string, name: string) => isin || norm(name);
  const S = new Map<string, { name: string; isin: string; sell: number; pnl: number }>(), L = new Map<string, { name: string; isin: string; sell: number; pnl: number }>();
  for (const l of lines) { if (l.sellDate && fyOf(l.sellDate) !== fy) continue; const k = key(l.isin, l.name), e = S.get(k) ?? S.set(k, { name: l.name, isin: l.isin, sell: 0, pnl: 0 }).get(k)!; e.sell += l.sell; e.pnl += l.pnl; }
  for (const r of cg) { if (r.fy !== fy) continue; const k = key(r.isin, r.name), e = L.get(k) ?? L.set(k, { name: r.name, isin: r.isin, sell: 0, pnl: 0 }).get(k)!; e.sell += r.proceeds; e.pnl += r.gain + r.expenses; }
  const byName = new Map([...L].map(([, v]) => [norm(v.name), v]));
  const rows: PnlRow[] = [], used = new Set<{ name: string }>();
  for (const [k, s] of S) {
    const l = L.get(k) ?? byName.get(norm(s.name)); if (l) used.add(l);
    if (!l) { rows.push({ name: s.name || s.isin, isin: s.isin, stmtSell: s.sell, ledgerSell: null, stmtPnl: s.pnl, ledgerPnl: null, status: 'only-statement', why: 'The statement shows a sale the tradebook has no record of, or one whose buy is missing so its gain was left out.' }); continue; }
    const tolr = Math.max(5, 0.005 * Math.abs(s.sell)), ok = Math.abs(s.pnl - l.pnl) <= tolr && Math.abs(s.sell - l.sell) <= tolr;
    rows.push({ name: l.name, isin: s.isin || l.isin, stmtSell: s.sell, ledgerSell: l.sell, stmtPnl: s.pnl, ledgerPnl: l.pnl, status: ok ? 'match' : 'differs',
      why: ok ? '' : Math.abs(s.sell - l.sell) > tolr ? 'The sale values differ: a sale is missing or counted twice in one of the two.' : `Same sales, but the profit differs by ₹${Math.round(s.pnl - l.pnl).toLocaleString('en-IN')}: the cost in the tradebook is probably wrong (a missing buy, an old holding, or a split or bonus).` });
  }
  for (const [, l] of L) if (!used.has(l)) rows.push({ name: l.name, isin: l.isin, stmtSell: null, ledgerSell: l.sell, stmtPnl: null, ledgerPnl: l.pnl, status: 'only-ledger', why: 'The tradebook has this sale but the statement does not: check the statement covers the same financial year and the same account.' });
  const n = (s: PnlRow['status']) => rows.filter((r) => r.status === s).length;
  return { fy, rows: rows.sort((a, b) => (a.status === 'match' ? 1 : 0) - (b.status === 'match' ? 1 : 0)), matched: n('match'), differ: n('differs'), onlyStatement: n('only-statement'), onlyLedger: n('only-ledger'), stmtTotal: [...S.values()].reduce((t, x) => t + x.pnl, 0), ledgerTotal: [...L.values()].reduce((t, x) => t + x.pnl, 0), verified: rows.length > 0 && n('match') === rows.length };
}
