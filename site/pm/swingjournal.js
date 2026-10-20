// Journal from real trades (Engine Rules C-77). A trade is a buy recognised as Swing (C-76), grouped by stock and buy date; its sells are the sales that closed those units.
// The maths is the Swing Desk's own (src/engine/journal.ts: R, equity on new trades only, risk halving, the Journal Test). Pure: no personal data is stored anywhere.
import { tradeR, tradePnl, equityCurve, halvingState, statsFor,            } from './engine/journal.js';

                                                                                                                                            
                                                                                                         
                                                                                                 
                                                                                                                                                                                                                                               

const EPS = 1e-6;
/** Groups recognised lots into trades. `recog` says whether a lot is a Swing trade (null = no). `exits` are sales the owner confirmed as a Swing exit. `rules` holds `rules:<key>|<buy date>` answers: yes = rules followed. */
export function buildTrades(hist           , recog                              , exits         , rules                              , name                         , price                                      )           {
  const groups = new Map                                         ();
  for (const l of [...hist].sort((a, b) => a.date.localeCompare(b.date))) {
    const rec = recog(l); if (!rec) continue;
    const k = `${l.key}|${l.date}`, g = groups.get(k); if (g) g.lots.push(l); else groups.set(k, { lots: [l], rec });
  }
  const out           = [];
  for (const [k, g] of groups) {
    const key = g.lots[0].key, date = g.lots[0].date;
    const sells = [...g.lots.flatMap((l) => l.sells), ...exits.filter((e) => e.key === key && e.buyDate === date).map((e) => ({ date: e.date, qty: e.qty, price: e.price }))].sort((a, b) => a.date.localeCompare(b.date));
    const bought = g.lots.reduce((t, l) => t + l.qty, 0), sold = sells.reduce((t, x) => t + x.qty, 0), heldQty = Math.max(0, bought - sold), closed = heldQty <= EPS && sold > 0;
    const ans = rules[`rules:${k}`];
    const t         = { key, name: name(key), setup: g.rec.setup, tier: g.rec.tier, status: closed ? 'closed' : 'open', entryDate: date, exitDate: closed ? sells[sells.length - 1].date : undefined,
      stop0: g.rec.stop, trigger: g.rec.trigger, fullShares: bought, boughtQty: bought, heldQty, closed,
      // one entry at the quantity-weighted average cost: the order of same-day fills is not known
      lots: [{ date, shares: bought, price: g.lots.reduce((t, l) => t + l.qty * l.unitCost, 0) / bought }], sells: sells.map((x) => ({ date: x.date, shares: x.qty, price: x.price })),
      rulesFollowed: ans === 'yes' ? true : ans === 'no' ? false : undefined, rulesAnswer: ans, r: null, pnl: 0,
      slipPct: g.rec.trigger > 0 ? Math.round(((g.lots.reduce((s, l) => s + l.qty * l.unitCost, 0) / bought) / g.rec.trigger - 1) * 10000) / 100 : null };
    if (closed) { t.pnl = tradePnl(t); const r = tradeR(t); t.r = Number.isFinite(r) ? r : null; }
    else if (price) { const px = price(key); if (px !== undefined) { const mark = { ...t, sells: [...(t.sells ?? []), { shares: heldQty, price: px }] }; const r = tradeR(mark); t.pnl = tradePnl(mark); t.r = Number.isFinite(r) ? r : null; } }
    out.push(t);
  }
  return out.sort((a, b) => (a.entryDate ?? '').localeCompare(b.entryDate ?? ''));
}

                             
                                                         
                                                                     
                                           
                                     
                                                                                                                              
                                                                                  
                  
 
const ok = (n         )              => typeof n === 'number' && Number.isFinite(n);
const days = (a        , b        ) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const fmtR = (r        ) => (r >= 0 ? '+' : '–') + Math.abs(r).toFixed(2) + 'R';

/** The Journal Test on closed Swing trades. Rule breaks come only from the owner's answers: a closed trade among the last 20 without one is "not recorded" and the test cannot pass. */
export function journalReport(trades          , startCapital        )             {
  const closed = trades.filter((t) => t.closed && t.r !== null).sort((a, b) => (a.exitDate ?? '').localeCompare(b.exitDate ?? '') || (a.entryDate ?? '').localeCompare(b.entryDate ?? ''));
  const open = trades.filter((t) => !t.closed);
  const eq = equityCurve(closed, startCapital), halving = halvingState(closed, startCapital), st = statsFor(closed);
  const last20 = closed.slice(-20), unrecorded = last20.filter((t) => t.rulesFollowed === undefined).length;
  const first = closed.map((t) => t.entryDate).filter(Boolean).sort()[0], last = closed.length ? closed[closed.length - 1].exitDate : undefined;
  const span = first && last ? days(first, last) : 0;
  const tests = [
    { k: 'Expectancy', pass: ok(st.exp) && st.exp >= 0.3, val: ok(st.exp) ? fmtR(st.exp) : '—' },
    { k: 'Average loss', pass: st.n > 0 && st.al <= 1.2, val: st.n ? '–' + st.al.toFixed(2) + 'R' : '—' },
    { k: 'Rule breaks (last 20)', pass: st.n > 0 && st.breaks <= 2 && unrecorded === 0, val: unrecorded ? `${st.breaks} recorded, ${unrecorded} not recorded` : String(st.breaks) },
    { k: 'Drawdown from peak', pass: st.n > 0 && eq.maxDD < 8, val: eq.maxDD.toFixed(1) + '%' },
  ];
  const enough = st.n >= 20 && span >= 90;
  const setups = [...new Set(closed.map((t) => t.setup))].sort();
  const bySetup = setups.map((s) => { const x = statsFor(closed.filter((t) => t.setup === s)); return { setup: s, n: x.n, exp: x.exp, al: x.al, pass: x.n >= 1 && x.exp >= 0.3 && x.al <= 1.2 }; });
  const notes = ['R is profit over (entry minus stop) times the units bought, before charges. MAE and MFE are not measured for real trades.'];
  if (trades.some((t) => t.closed && t.r === null)) notes.push('A closed trade without a usable stop is left out of the tests.');
  return { closed, open, startCapital, equity: eq, halving, stats: st, tests, enough, span, unrecorded, provenGreen: enough && tests.every((t) => t.pass), bySetup, notes };
}
