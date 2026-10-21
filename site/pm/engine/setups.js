// Setup definitions and per-light limits. Implements Engine Rules "Setups and entry calculation" and
// "Position sizing and limits per market". Values copied from app v9 (SETUPS, LIMITS, LIMITS_US) as at R-2026.10.9 (the Red rows follow C-24 and C-38).

                                                     
                                                                                                                                                                               

export const SETUPS                         = {
  '1': { id: '1', short: 'Base breakout', stopHint: 'Low of the last tight area', trig: 0.5, lim: 1, maxStop: 8, breakout: true },
  '1ipo': { id: '1ipo', short: 'IPO base', stopHint: 'Low of the last tight area', trig: 0.5, lim: 1, maxStop: 10, breakout: true, ipo: true },
  '2': { id: '2', short: '20 EMA pullback', stopHint: 'Pullback low', trig: 0.2, lim: 1, maxStop: 7 },
  '3': { id: '3', short: 'Earnings gap', stopHint: 'Gap-day low', trig: 0.2, lim: 1.5, maxStop: 8, breakout: true, resultsExempt: true },
  '4': { id: '4', short: '50 SMA pullback', stopHint: 'Lowest low of the pullback', trig: 0.2, lim: 1, maxStop: 6 },
};

                                               
                              
                    
                                                     
                                                       
                                                  
                                                                                               
 
                                    

/** The limits exactly as app v9 had them (Red accepts every setup). Kept so replays against v9 stay possible. */
export const LIMITS_V9                                             = {
  india: {
    green: { setups: ['1', '1ipo', '2', '3', '4'], top: 4, risk: 0.5, maxPos: 10, cap: 5 },
    yellow: { setups: ['1', '1ipo', '3', '4'], top: 2, risk: 0.5, maxPos: 5, cap: 2.5 },
    red: { setups: ['1', '1ipo', '2', '3', '4'], top: 4, risk: 0.25, maxPos: 2, cap: 0.5 },
  },
  us: {
    green: { setups: ['1', '1ipo', '2', '4'], top: 4, risk: 0.5, maxPos: 4, cap: 2 },
    yellow: { setups: ['1', '1ipo', '4'], top: 2, risk: 0.5, maxPos: 4, cap: 2 },
    red: { setups: ['1', '1ipo', '2', '4'], top: 4, risk: 0.25, maxPos: 2, cap: 0.5 },
  },
};

/**
 * Limits as the rules now say (Engine Rules C-24 / OQ-8, owner decision 3 Oct 2026): Red is pilots only and allows setups 1 and 4 in both
 * markets (setup 3 and 1ipo are out, setup 2 was already out). Pilot size (0.25%), 2 positions and 0.5% open risk were already in the
 * table; the RS-leader-above-own-50-SMA path is enforced by the checklist. Interim, to be covered by the phase 6 backtest (OQ-3).
 */
export const LIMITS                                             = {
  india: { ...LIMITS_V9.india, red: { ...LIMITS_V9.india.red, setups: ['1', '4'] } },
  us: { ...LIMITS_V9.us, red: { ...LIMITS_V9.us.red, setups: ['1', '4'] } },
};
