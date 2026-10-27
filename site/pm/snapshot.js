// Holdings-statement check (design section 11, "holdings-snapshot gate"). The broker's own statement of what you hold today is compared with what the
// tradebook says you hold. A match removes the "unverified" label; a difference points at a missing order, a corporate action or a transfer.
// The statement itself is read in the browser and only the outcome is kept. Deterministic; no model call.
import { num } from './reader.js';

                                                                                           
                                                                                       
const norm = (s        ) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SYN = {
  isin: ['isin', 'isin code', 'isin no'],
  name: ['stock name', 'scheme name', 'security name', 'scrip name', 'instrument', 'name', 'company name', 'symbol', 'fund name', 'scrip'],
  qty: ['quantity', 'qty', 'units', 'closing balance', 'quantity available', 'total quantity', 'balance', 'net qty', 'current balance', 'free balance', 'holding quantity', 'quantity long', 'total units'],
  value: ['closing value', 'current value', 'market value', 'value', 'current amount', 'closing amount', 'valuation'],
};
const pick = (hdr          , list          ) => hdr.findIndex((h) => list.includes(norm(h)));

/** Finds the header row (it has an ISIN or a name column and a quantity column) and reads every row below it that has a positive quantity. */
export function readSnapshot(rows            )                  {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const hdr = rows[i].map((c) => String(c ?? '')); const qi = pick(hdr, SYN.qty), ii = pick(hdr, SYN.isin), ni = pick(hdr, SYN.name);
    if (qi < 0 || (ii < 0 && ni < 0)) continue;
    const vi = pick(hdr, SYN.value), lines             = [];
    for (const r of rows.slice(i + 1)) {
      const q = num(String(r[qi] ?? '')); if (!(q > 0)) continue;
      const isin = ii >= 0 ? String(r[ii] ?? '').trim().toUpperCase() : '', name = ni >= 0 ? String(r[ni] ?? '').trim() : '';
      if (ii >= 0 && !ISIN.test(isin) && !name) continue;
      lines.push({ isin: ISIN.test(isin) ? isin : '', name, qty: q, value: vi >= 0 && Number.isFinite(num(String(r[vi] ?? ''))) ? num(String(r[vi] ?? '')) : null });
    }
    if (lines.length) return { lines, headerRow: i, note: ii < 0 ? 'The statement has no ISIN column, so holdings were matched by name, which is less certain.' : null };
  }
  return null;
}

                                                                            
                                                                                                                                      
                                                                                                                                          

const tol = (a        , b        , fund         ) => Math.abs(a - b) <= (fund ? Math.max(0.05, 0.001 * Math.max(a, b)) : 0.0001);

/** `ledger`: what the tradebook says is held now. A statement and a ledger agree when every line matches; a few units of rounding on a fund are allowed. */
export function reconcile(snap            , ledger                                                                                )        {
  const byIsin = new Map                               (), byName = new Map                               (); const used = new Set                       ();
  for (const l of ledger) { if (l.isin) byIsin.set(l.isin, l); byName.set(norm(l.name), l); }
  const rows             = [];
  for (const s of snap) {
    const l = (s.isin && byIsin.get(s.isin)) || byName.get(norm(s.name)); if (l) used.add(l);
    if (!l) { rows.push({ name: s.name || s.isin, isin: s.isin, statement: s.qty, ledger: null, status: 'only-statement', why: 'On the statement but not in the tradebook: a purchase may be missing, or the shares came in by transfer, bonus or IPO.' }); continue; }
    const fund = l.kind === 'Fund';
    if (tol(s.qty, l.qty, fund)) rows.push({ name: l.name, isin: s.isin || l.isin || '', statement: s.qty, ledger: l.qty, status: 'match', why: '' });
    else rows.push({ name: l.name, isin: s.isin || l.isin || '', statement: s.qty, ledger: l.qty, status: 'differs', why: s.qty > l.qty ? `The statement shows ${s.qty - l.qty} more than the tradebook: a buy, bonus or transfer-in may be missing.` : `The statement shows ${l.qty - s.qty} fewer than the tradebook: a sale or a corporate action (split, demerger, merger) may be missing.` });
  }
  for (const l of ledger) if (!used.has(l) && l.qty > 0) rows.push({ name: l.name, isin: l.isin ?? '', statement: null, ledger: l.qty, status: 'only-ledger', why: 'In the tradebook but not on the statement: it may have been sold outside the files, or sits with another broker.' });
  const n = (s        ) => rows.filter((r) => r.status === s).length;
  return { rows: rows.sort((a, b) => (a.status === 'match' ? 1 : 0) - (b.status === 'match' ? 1 : 0)), matched: n('match'), differ: n('differs'), onlyStatement: n('only-statement'), onlyLedger: n('only-ledger'), verified: rows.length > 0 && n('match') === rows.length };
}
