// Trades added by hand between monthly uploads (Engine Rules C-114). Pure: used by the page, the save route and the nightly scripts.
// A hand-added trade is stored with the account (`manual`) and counts in every calculation until the next upload covers its date. The broker's file always wins:
// each time the account is read, every hand-added trade is checked against the uploaded trades and is either pending (counted), matched or different (dropped; the broker's figure stands) or "check" (the upload covers its date and has no such trade; dropped and listed).
                                         

                                                                                                                                                                                                                  
                                                                          
                                                                              

const DATE = /^\d{4}-\d\d-\d\d$/, ID = /^[A-Za-z0-9_.-]{1,40}$/;
const num = (x         )              => typeof x === 'number' && Number.isFinite(x);
const norm = (s        ) => s.toLowerCase().replace(/\b(limited|ltd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const dayMs = (d        ) => Date.parse(d.slice(0, 10) + 'T00:00:00Z');
const day = (d        ) => Math.round(dayMs(d) / 86400000);

/** Rebuilds each entry from a whitelist of fields (nothing else is stored). Returns an error text for a bad list. */
export function cleanManual(input         )                         {
  if (!Array.isArray(input)) return 'manual trades must be a list';
  if (input.length > 200) return 'too many hand-added trades';
  const out                = [];
  for (const [i, t] of input.entries()) {
    const x = (t ?? {})                           ;
    if (typeof x.id !== 'string' || !ID.test(x.id)) return `hand-added trade ${i}: bad id`;
    if (typeof x.symbol !== 'string' || !/^[A-Za-z0-9&._-]{1,30}$/.test(x.symbol)) return `hand-added trade ${i}: bad symbol`;
    if (typeof x.instrument !== 'string' || x.instrument.length < 1 || x.instrument.length > 120) return `hand-added trade ${i}: bad name`;
    if (typeof x.isin !== 'string' || x.isin.length > 20) return `hand-added trade ${i}: bad isin`;
    if (x.side !== 'buy' && x.side !== 'sell') return `hand-added trade ${i}: bad side`;
    if (!num(x.qty) || !(x.qty > 0) || x.qty > 1e7 || !num(x.price) || !(x.price > 0) || x.price > 1e7) return `hand-added trade ${i}: bad quantity or price`;
    if (typeof x.date !== 'string' || !DATE.test(x.date)) return `hand-added trade ${i}: bad date`;
    if (x.stop !== undefined && !(num(x.stop) && x.stop >= 0 && x.stop <= 1e7)) return `hand-added trade ${i}: bad stop`;
    const o              = { id: x.id, symbol: x.symbol.toUpperCase(), instrument: x.instrument, isin: x.isin, side: x.side, qty: x.qty, price: x.price, date: x.date, addedAt: typeof x.addedAt === 'string' ? x.addedAt.slice(0, 30) : '' };
    if (x.stop !== undefined && (x.stop          ) > 0) o.stop = x.stop          ;
    if (x.fromOrder === true) o.fromOrder = true;
    out.push(o);
  }
  return out;
}

/** A new entry from what the owner typed. The instrument name and ISIN are copied from the account's own trades when the stock is already there (so the pipeline sees one stock), else the company name from the names file, else the symbol. */
export function makeManual(p                                                                                                                                      , known         , names                         = {})              {
  const sym = p.symbol.trim().toUpperCase(), nm = names[sym] ? norm(names[sym]) : '';
  const t = known.find((k) => (k.symbol ?? '').toUpperCase() === sym) ?? (nm ? known.find((k) => norm(k.instrument) === nm) : undefined);
  const now = p.now ?? new Date().toISOString();
  const o              = { id: 'm' + now.replace(/\D/g, '').slice(0, 14) + Math.random().toString(36).slice(2, 6), symbol: sym, instrument: t?.instrument ?? names[sym] ?? sym, isin: t?.isin ?? '', side: p.side, qty: p.qty, price: p.price, date: p.date, addedAt: now };
  if (p.stop && p.stop > 0) o.stop = p.stop; if (p.fromOrder) o.fromOrder = true;
  return o;
}

export const asTrade = (m             )        => ({ instrument: m.instrument, symbol: m.symbol, isin: m.isin, side: m.side, qty: m.qty, price: m.price, value: +(m.qty * m.price).toFixed(2), date: m.date, time: '15:30', exchange: 'NSE', orderId: m.id, tradeId: m.id, kind: 'stock' });

                                                                                                                              
/** The trades every calculation should use: the uploaded ones plus the hand-added ones the uploads do not yet cover. `names` = symbol to company name (the broker's file often has the company name only). */
export function reconcile(uploaded         , manual                           , names                         = {})             {
  const last = uploaded.reduce((m, t) => (t.date > m ? t.date : m), '');
  if (!manual?.length) return { effective: uploaded, notes: [], stops: {}, lastUploadDate: last };
  const same = (t       , m             ) => (t.symbol ?? '').toUpperCase() === m.symbol || (!!t.isin && !!m.isin && t.isin === m.isin) || norm(t.instrument) === norm(m.instrument) || (!!names[m.symbol] && norm(t.instrument) === norm(names[m.symbol]));
  const groups = new Map                       ();
  for (const m of manual) { const k = `${m.symbol}|${m.side}|${m.date}`; (groups.get(k) ?? groups.set(k, []).get(k) ).push(m); }
  const notes               = [], pending                = [];
  for (const g of groups.values()) {
    const m0 = g[0], qty = g.reduce((a, m) => a + m.qty, 0), avg = g.reduce((a, m) => a + m.qty * m.price, 0) / qty;
    const up = uploaded.filter((t) => t.side === m0.side && Math.abs(day(t.date) - day(m0.date)) <= 1 && same(t, m0));
    const uq = up.reduce((a, t) => a + t.qty, 0), up_avg = uq ? up.reduce((a, t) => a + t.qty * t.price, 0) / uq : 0;
    const label = `${m0.side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${m0.symbol} on ${m0.date}`;
    const put = (status              , text        ) => { for (const m of g) notes.push({ id: m.id, status, text }); };
    if (!up.length) {
      if (last && m0.date <= last) put('check', `${label}: your upload covers this date (last trade ${last}) and has no such trade. Left out of every calculation. Remove it, or add the broker's file again if it should be there.`);
      else { put('pending', `${label}: counted until your next upload shows it.`); pending.push(...g); }
    } else if (Math.abs(uq - qty) < 1e-6) {
      const off = Math.abs(up_avg / avg - 1) > 0.005;
      put(off ? 'difference' : 'matched', off ? `${label}: matched your upload. You typed ${avg.toFixed(2)} a share, the broker has ${up_avg.toFixed(2)}; the broker's figure is used.` : `${label}: matched your upload.`);
    } else put('difference', `${label}: you typed ${qty}, the broker shows ${uq} on those dates; the broker's figure is used.`);
  }
  const stops                         = {}; for (const m of pending) if (m.side === 'buy' && m.stop) stops[m.instrument] = m.stop;
  return { effective: [...uploaded, ...pending.map(asTrade)], notes, stops, lastUploadDate: last };
}
/** What the pipeline and the sizing read for an account: the trades to use, and the stop levels typed with hand-added buys (the owner's own stops, set on the page, win). */
export function tradesOf(a                                             , names                         = {})             { return reconcile(a.trades, a.manual, names); }
