// Allocation engine (Portfolio Manager phase 5, design section 8). Pure: settings and inputs in, one target per asset class out, with the rule behind each number.
// No input is fixed except what the owner types; every number lives in settings/allocation.json (starting values, not yet reviewed). The result is a target, never an order:
// rebalancing and new-money sizing are phase 6. Two properties are tested on every combination of the selectable inputs (test/pm-allocation.test.ts):
// 1. targets add to 100% and respect every minimum, maximum and cap, or a plain message says which constraints clash; it never returns a guess.
// 2. a one-notch change in any input moves the targets by a bounded amount; the equity share is a continuous curve of the horizon, so no band edge flips the portfolio.
export const TARGET_CLASSES = ['direct_equity', 'active_equity_fund', 'index', 'sector_thematic', 'gold', 'silver', 'international', 'debt', 'liquid']         ;
                                                          
                                                             

                                
                                 
                                                                   
                                                                                                                        
                                         
                                                                     
                                                                         
                                                                  
                                                     
 
                             
                                                                                                           
                                                    
                                                                                         
                                                                           
                                                                                                                                                      
                                                                                                                                       
 
                                                                                                                                        
                         
                                                                                                                                                                                                                 
                                                    

const pct = (x        ) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
/** Piecewise-linear value at h between the anchors, flat beyond the ends: continuous in h by construction. */
export function interp(anchors          , vals          , h        )         {
  if (h <= anchors[0]) return vals[0]; if (h >= anchors[anchors.length - 1]) return vals[vals.length - 1];
  for (let i = 1; i < anchors.length; i++) if (h <= anchors[i]) { const t = (h - anchors[i - 1]) / (anchors[i] - anchors[i - 1]); return vals[i - 1] + t * (vals[i] - vals[i - 1]); }
  return vals[vals.length - 1];
}

/** Base weights from the preset (before scope and caps), summing to 1. */
export function baseWeights(s               , profile         , h        )                                                                     {
  const E = interp(s.horizonAnchors, s.equityShare[profile], h), direct = Math.min(s.equitySplit.directEquity[profile], s.equitySplit.directEquityOfEquityMax * E), rest = E - direct;
  const w = Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0]))                               ;
  w.direct_equity = direct;
  for (const [c, f] of Object.entries(s.equitySplit.rest)) w[c               ] += rest * f;
  for (const [c, f] of Object.entries(s.nonEquitySplit)) w[c               ] += (1 - E) * f;
  return { w, equity: E, direct };
}

/** Scales the weights to sum to 1 inside [lo, hi] by clamping violators and re-spreading the rest in proportion. Continuous in the weights. */
function waterfill(w0                        , lo                        , hi                        , keys          )                                                                                                             {
  const sLo = keys.reduce((a, k) => a + lo[k], 0), sHi = keys.reduce((a, k) => a + hi[k], 0);
  if (sLo > 1 + 1e-9) return { error: 'The minimums add to more than 100%.', clashes: [`Class minimums total ${pct(sLo)}: ${keys.filter((k) => lo[k] > 0).map((k) => `${k} ${pct(lo[k])}`).join(', ')}.`] };
  if (sHi < 1 - 1e-9) return { error: 'The chosen classes and their maximums cannot reach 100%.', clashes: [`Class maximums total ${pct(sHi)}: ${keys.map((k) => `${k} ${pct(hi[k])}`).join(', ')}. Add classes to the scope or raise a maximum.`] };
  const fixed                         = {}, bound                                = {};
  for (let it = 0; it < 30; it++) {
    const free = keys.filter((k) => !(k in fixed)), rem = 1 - Object.values(fixed).reduce((a, b) => a + b, 0), sw = free.reduce((a, k) => a + w0[k], 0);
    if (!free.length) break;
    const x                         = {};
    if (sw > 0) for (const k of free) x[k] = (w0[k] * rem) / sw;
    else { const room = free.reduce((a, k) => a + hi[k] - lo[k], 0); if (room <= 0) break; for (const k of free) x[k] = lo[k] + ((hi[k] - lo[k]) * (rem - free.reduce((a, j) => a + lo[j], 0))) / room; }
    const viol = free.filter((k) => x[k] > hi[k] + 1e-12 || x[k] < lo[k] - 1e-12);
    if (!viol.length) { return { w: { ...fixed, ...x }, bound }; }
    for (const k of viol) { if (x[k] > hi[k]) { fixed[k] = hi[k]; bound[k] = 'max'; } else { fixed[k] = lo[k]; bound[k] = 'min'; } }
  }
  const total = Object.values(fixed).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) < 1e-9) return { w: fixed, bound };
  return { error: 'No allocation satisfies every cap together.', clashes: ['The minimum and maximum caps leave no room for the remaining classes.'] };
}

export function allocate(s               , i            )              {
  const notes           = [];
  if (!(i.capital > 0)) return { ok: false, error: 'Total capital must be a positive amount.', clashes: [] };
  if (!(i.horizonYears >= 0)) return { ok: false, error: 'The horizon must be zero or more years.', clashes: [] };
  const scope = (i.inScope ?? [...TARGET_CLASSES]).filter((c) => (TARGET_CLASSES                     ).includes(c));
  if (!scope.length) return { ok: false, error: 'No asset class is switched on.', clashes: [] };
  const lo                         = {}, hi                         = {};
  for (const c of TARGET_CLASSES) { lo[c] = scope.includes(c) ? i.caps?.classMin?.[c] ?? s.classMin[c] ?? 0 : 0; hi[c] = scope.includes(c) ? i.caps?.classMax?.[c] ?? s.classMax[c] ?? 1 : 0; }
  const inv = scope.filter((c) => lo[c] > hi[c] + 1e-12);
  if (inv.length) return { ok: false, error: 'A class minimum is above its maximum.', clashes: inv.map((c) => `${s.labels[c] ?? c}: minimum ${pct(lo[c])} is above maximum ${pct(hi[c])}.`) };
  const prof = i.profile === 'Custom' ? 'Balanced' : i.profile;
  const posCap = i.caps?.positionCap ?? s.positionCap[prof], fundCap = i.caps?.fundCap ?? s.fundCap[prof];
  let w0                        , equity        , why                            ;
  if (i.profile === 'Custom') {
    const c = i.custom ?? {}, bad = Object.keys(c).filter((k) => !(TARGET_CLASSES                     ).includes(k)), sum = Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
    if (bad.length) return { ok: false, error: `Unknown asset class: ${bad.join(', ')}.`, clashes: [] };
    if (Object.values(c).some((v) => (v ?? 0) < 0)) return { ok: false, error: 'A custom weight is negative.', clashes: [] };
    if (Math.abs(sum - 1) > 0.0005) return { ok: false, error: `Custom weights add to ${pct(sum)}, not 100%.`, clashes: [] };
    const clashes           = [];
    for (const k of TARGET_CLASSES) { const v = c[k] ?? 0; if (!scope.includes(k) && v > 0) clashes.push(`${s.labels[k] ?? k} is switched off but has a weight of ${pct(v)}.`); else if (v < lo[k] - 1e-9) clashes.push(`${s.labels[k] ?? k} ${pct(v)} is below its minimum ${pct(lo[k])}.`); else if (v > hi[k] + 1e-9) clashes.push(`${s.labels[k] ?? k} ${pct(v)} is above its maximum ${pct(hi[k])}.`); }
    if (clashes.length) return { ok: false, error: 'The custom weights break a cap.', clashes };
    w0 = Object.fromEntries(TARGET_CLASSES.map((k) => [k, c[k] ?? 0])); equity = (['direct_equity', 'active_equity_fund', 'index', 'sector_thematic', 'international']         ).reduce((a, k) => a + (c[k] ?? 0), 0);
    why = () => 'your custom weight';
    notes.push('Custom weights: the position and fund caps use the Balanced preset unless you set them.');
  } else {
    const b = baseWeights(s, i.profile, i.horizonYears); equity = b.equity;
    const drop = TARGET_CLASSES.filter((k) => !scope.includes(k) && b.w[k] > 0);
    const keep = scope.reduce((a, k) => a + b.w[k], 0);
    if (!(keep > 0)) return { ok: false, error: 'The chosen classes have no weight under this profile and horizon.', clashes: [`Under ${i.profile} at ${i.horizonYears} years the preset puts nothing in ${scope.map((k) => s.labels[k] ?? k).join(', ')}. Use custom weights or switch on more classes.`] };
    w0 = Object.fromEntries(TARGET_CLASSES.map((k) => [k, scope.includes(k) ? b.w[k] / keep : 0]));
    if (drop.length) notes.push(`Switched-off classes (${drop.map((k) => s.labels[k] ?? k).join(', ')}) had ${pct(drop.reduce((a, k) => a + b.w[k], 0))} in the preset; it is spread over the classes that are on, in proportion.`);
    why = (c) => c === 'direct_equity' ? `${i.profile} swing allocation ${pct(s.equitySplit.directEquity[i.profile           ])}, at most ${pct(s.equitySplit.directEquityOfEquityMax)} of the ${pct(equity)} equity share` : `${i.profile} preset: equity ${pct(equity)} at ${i.horizonYears} years, split by the preset ratios`;
  }
  const f = waterfill(w0, lo, hi, scope);
  if ('error' in f) return { ok: false, ...f };
  const rows                = TARGET_CLASSES.filter((c) => scope.includes(c)).map((c) => {
    const t = f.w[c], bd = f.bound[c];
    return { cls: c, label: s.labels[c] ?? c, target: t, amount: t * i.capital, min: lo[c], max: hi[c], rule: bd === 'max' ? `held at its maximum ${pct(hi[c])} (preset wanted more)` : bd === 'min' ? `held at its minimum ${pct(lo[c])}` : why(c) };
  });
  const eqKeys = ['direct_equity', 'active_equity_fund', 'index', 'sector_thematic', 'international'];
  const equityShareOut = rows.filter((r) => eqKeys.includes(r.cls)).reduce((a, r) => a + r.target, 0);
  return { ok: true, rows, equityShare: equityShareOut, positionCap: posCap, positionCapAmount: posCap * i.capital, fundCap, fundCapAmount: fundCap * i.capital, drawdownLimit: equityShareOut * s.bearMarketEquityFall, buffer: i.buffer && i.buffer > 0 ? i.buffer : null, notes };
}

// ---------- current position against the targets
                                                                                                                                  
                                                                                                                                                                                                                     
/** Folds hybrid holdings into equity, debt and gold by the category's mandated midpoint (settings.hybridFold). Equity part goes to active equity funds. */
export function foldHybrid(s               , category = '')                         {
  const c = category.toLowerCase(); for (const [k, v] of Object.entries(s.hybridFold)) if (k !== 'default' && k !== 'note' && c.includes(k)) return v;
  return s.hybridFold.default;
}
export function currentByClass(s               , held        )                                                                                                                        {
  const by = Object.fromEntries(TARGET_CLASSES.map((c) => [c, 0]))                               ; let unclassified = 0, unpriced = 0, hybridFolded = 0;
  for (const h of held) {
    if (h.value === null) { unpriced++; continue; }
    if (h.cls === null) { unclassified += h.value; continue; }
    if (h.cls === 'hybrid') { hybridFolded += h.value; for (const [k, f] of Object.entries(foldHybrid(s, h.category))) by[k === 'equity' ? 'active_equity_fund' : (k               )] += h.value * f; continue; }
    by[h.cls] += h.value;
  }
  return { byClass: by, total: Object.values(by).reduce((a, b) => a + b, 0), unclassified, unpriced, hybridFolded };
}
export function gapRows(s               , targets               , current                             , base        )           {
  const inScope = new Set(targets.map((t) => t.cls));
  return TARGET_CLASSES.filter((c) => inScope.has(c) || current[c] > 0).map((c) => {
    const t = targets.find((x) => x.cls === c), target = t?.target ?? 0, cur = base > 0 ? current[c] / base : 0, band = s.driftBand[c] ?? s.driftBand.default, gap = cur - target;
    return { cls: c, label: s.labels[c] ?? c, target, current: cur, gap, band, state: !t ? 'not in scope' : Math.abs(gap) <= band ? 'within band' : gap < 0 ? 'underweight' : 'overweight', amountToTarget: (target - cur) * base };
  });
}
/** Single-holding caps: a stock above the position cap, a fund above the fund cap. Names only; no sale is proposed here. */
export function capBreaches(held        , base        , posCap        , fundCap        )                                                                {
  if (!(base > 0)) return [];
  return held.filter((h) => h.value !== null && h.kind && h.kind !== 'ETF').map((h) => ({ name: h.name, weight: (h.value          ) / base, cap: h.kind === 'Fund' ? fundCap : posCap, kind: h.kind           })).filter((x) => x.weight > x.cap).sort((a, b) => b.weight - a.weight);
}
