// Trade arithmetic, equity curve, risk halving and the Journal Test. Implements Engine Rules "Entry mechanics and book rules"
// (equity basis, risk halving, MAE/MFE) and "Exits, journal and review" (journal and fresh-money test).
// Ported from app v9 (held, avgCost, rPerShare, tradePnl, tradeR, equityCurve, halvingState, statsFor, freshMoney).
// Equity is computed on NEW trades only; the legacy book is separate (C-28).
import { rr, pct, daysBetween } from './format.js';

                                                                                    
                                                                                     
                        
                                                                                                                
                                                        
                                                                                                                          
                 
 
const ok = (n         )              => typeof n === 'number' && Number.isFinite(n);

export const held = (t       )         => (t.lots ?? []).reduce((s, l) => s + l.shares, 0) - (t.sells ?? []).reduce((s, x) => s + x.shares, 0);
export function avgCost(t       )         {
  const sh = (t.lots ?? []).reduce((s, l) => s + l.shares, 0);
  return sh ? (t.lots ?? []).reduce((s, l) => s + l.shares * l.price, 0) / sh : NaN;
}
export const firstEntry = (t       )         => (t.lots && t.lots.length ? t.lots[0].price : (t.trigger          ));
export const rPerShare = (t       )         => firstEntry(t) - (t.stop0          );
export function tradePnl(t       )         {
  const buy = (t.lots ?? []).reduce((s, l) => s + l.shares * l.price, 0);
  const sell = (t.sells ?? []).reduce((s, x) => s + x.shares * x.price, 0);
  return sell - buy;
}
/** R multiple: P&L over (R per share x full planned shares, or 1 if unknown). */
export function tradeR(t       )         {
  const oneR = rPerShare(t) * (t.fullShares || 1);
  return oneR > 0 ? tradePnl(t) / oneR : NaN;
}

/** `closed` must be sorted by exit date, oldest first. */
export function equityCurve(closed         , startCapital        ) {
  let eq = startCapital, peak = eq, maxDD = 0;
  const pts                                             = [];
  for (const t of closed) {
    eq += tradePnl(t); peak = Math.max(peak, eq);
    const dd = ((peak - eq) / peak) * 100; maxDD = Math.max(maxDD, dd);
    pts.push({ eq, peak, dd });
  }
  const cur = pts.length ? pts[pts.length - 1] : { eq, peak, dd: 0 };
  return { eq: cur.eq, peak: cur.peak, curDD: cur.dd, maxDD };
}

/** Risk halving: three losing trades in a row, or equity 5% below peak; ends after two winners close (streak case only). */
export function halvingState(closed         , startCapital        ) {
  let streak = 0, halved = false, wins = 0;
  for (const t of closed) {
    const r = tradeR(t); if (!ok(r)) continue;
    if (r < 0) { streak++; if (streak >= 3) { halved = true; wins = 0; } }
    else { streak = 0; if (halved && r > 0) { wins++; if (wins >= 2) halved = false; } }
  }
  const dd = equityCurve(closed, startCapital).curDD;
  return { halved: halved || dd >= 5, streakHalved: halved, ddHalved: dd >= 5, dd };
}

export function statsFor(list         ) {
  const rs = list.map(tradeR).filter(ok); const n = rs.length;
  const wins = rs.filter((r) => r > 0), losses = rs.filter((r) => r <= 0);
  const wr = n ? wins.length / n : NaN;
  const aw = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const al = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  const exp = n ? wr * aw - (1 - wr) * al : NaN;
  const last20 = list.slice(-20); const breaks = last20.filter((t) => t.rulesFollowed === false).length;
  return { n, wr, aw, al, exp, breaks };
}

/** The Journal Test (fresh-money test): 20 closed trades over 90 days and four tests, on new-trade equity. */
export function freshMoney(closed         , startCapital        ) {
  const st = statsFor(closed); const eqc = equityCurve(closed, startCapital);
  const first = closed.length ? closed.map((t) => t.entryDate).filter(Boolean).sort()[0] : null;
  const last = closed.length ? closed[closed.length - 1].exitDate : null;
  const span = first && last ? daysBetween(first, last) : 0;
  const tests = [
    { k: 'Expectancy', pass: ok(st.exp) && st.exp >= 0.3, val: rr(st.exp) },
    { k: 'Average loss', pass: st.n > 0 && st.al <= 1.2, val: st.n ? (st.al ? '–' + st.al.toFixed(2) + 'R' : '0R') : '—' },
    { k: 'Rule breaks (last 20)', pass: st.n > 0 && st.breaks <= 2, val: String(st.breaks) },
    { k: 'Drawdown from peak', pass: st.n > 0 && eqc.maxDD < 8, val: pct(eqc.maxDD) },
  ];
  const enough = st.n >= 20 && span >= 90;
  return { tests, enough, span, n: st.n, pass: enough && tests.every((t) => t.pass) };
}
