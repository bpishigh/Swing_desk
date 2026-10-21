// Entry calculation: trigger, limit, stop, size. Implements Engine Rules "Setups and entry calculation" and
// "Entry mechanics and book rules" (60/40 entry, pilot size, 20% position cap). Ported from app v9 ntCalc.
import { SETUPS,              } from './setups.js';
                                         

                                                                                               
                          
                 
                                                           
                    
                                                   
                                                             
                                                        
                  
                                                    
                                                                                                               
                              
                     
 
                           
                                                                                                           
                                                                                                                   
                                                                                                                                                              
 
const ok = (n         )              => typeof n === 'number' && Number.isFinite(n);

export function ntCalc(i         )           {
  const setup = SETUPS[i.setup] ?? SETUPS['1'];
  const out           = {};
  if (!(i.basis > 0) || !(i.chartStop > 0)) return out;
  if (!ok(i.capital)) return out;
  out.trigger = i.basis * (1 + setup.trig / 100);
  out.limit = out.trigger * (1 + setup.lim / 100);
  const refPx = ok(i.close) && i.close > 0 ? i.close : i.basis;
  out.atrPct = ok(i.atr) && i.atr > 0 ? (i.atr / refPx) * 100 : NaN;
  out.volatile = ok(out.atrPct) && out.atrPct > 3; // ATR above 3% means close-confirmed entry
  const entry = out.trigger; out.entry = entry;
  let stop = i.chartStop; out.floored = false;
  if (ok(i.atr) && i.atr > 0 && entry - i.chartStop < 1.5 * i.atr) { stop = entry - 1.5 * i.atr; out.floored = true; }
  out.stop = stop; out.rps = entry - stop; out.stopPct = (out.rps / entry) * 100;
  const ss = i.sector ?? null;
  let riskPct = i.light ? i.riskBase : 0.25; out.pilot = false;
  const red = i.light === 'red';
  if (!red && ss && !ss.persist && ss.newLeader) { riskPct = Math.min(riskPct, 0.25); out.pilot = true; }
  if (i.bottomUp && !(ss && ss.persist)) { riskPct = Math.min(riskPct, 0.25); out.pilot = true; }
  if (!red && ss && ss.above200 === false) { riskPct = Math.min(riskPct, 0.25); out.pilot = true; out.early = true; }
  out.riskPct = riskPct; out.oneR = (i.capital * riskPct) / 100;
  if (out.rps > 0) {
    let full = Math.floor(out.oneR / out.rps);
    const cap20 = Math.floor((i.capital * 0.2) / entry); // position cap: 20% of capital
    out.capped = full > cap20; full = Math.min(full, cap20);
    out.full = full; out.first = Math.floor(full * 0.6); out.add = full - out.first;
    out.pos = full * entry; out.posPct = (out.pos / i.capital) * 100;
    out.p1 = entry + out.rps; out.p2 = entry + 2 * out.rps;
    out.noOverhead = ok(i.resistance) && i.resistance <= entry; // 0 or a level at or below the entry means nothing above: the room test passes (rule 5)
    out.room = ok(i.resistance) && i.resistance > entry ? (i.resistance - entry) / out.rps : NaN;
  }
  return out;
}
