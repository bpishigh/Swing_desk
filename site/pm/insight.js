// What the numbers mean: a period (since start, a financial year, last 12 months), the same money put into an index instead, and whether returns are gaining or fading.
// Pure functions on dated cash flows and daily values, so the page and the tests use the same code. No personal data is read here.
import { xirr,           } from './performance.js';
                                               

                                                                  
/** Direct-plan index funds stand in for the indices (their NAV tracks the index less a small fee). The page says so. Codes are AMFI scheme codes. */
export const BENCHMARKS          = [
  { id: 'n50', label: 'Nifty 50', code: '120716' },
  { id: 'n100', label: 'Large cap (Nifty 100)', code: '147666' },
  { id: 'mid', label: 'Midcap 150', code: '147622' },
  { id: 'small', label: 'Smallcap 250', code: '147623' },
  { id: 'n500', label: 'Nifty 500', code: '147625' },
];
                                         

const dayNo = (d        ) => Date.parse(d) / 86400000;
export const shiftDays = (d        , n        )         => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
export function shiftMonths(d        , n        )         {
  const t = new Date(Date.parse(d)); const day = t.getUTCDate(); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() + n);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}
/** Index value on or before a date; undefined when the index has no history that early. */
export function navLookup(nav                 )                                       {
  const ds = nav ? Object.keys(nav).sort() : [];
  return (date) => {
    if (!nav || !ds.length || date < ds[0]) return undefined;
    let lo = 0, hi = ds.length - 1, best = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ds[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    return nav[ds[best]];
  };
}
export function sumSeries(list              )             {
  const by = new Map                  ();
  for (const s of list) for (const p of s) { const e = by.get(p.date) ?? by.set(p.date, { date: p.date, value: 0, invested: 0, missingPrices: 0 }).get(p.date) ; e.value += p.value; e.invested += p.invested; e.missingPrices += p.missingPrices; }
  const out = [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
  // an account that starts later contributes 0 before its first day; one that has no price on a day carries its last value (already done per account)
  return out;
}

                                                                                      
export const fyBounds = (fy        , asOf        )         => {
  const y = +fy.slice(0, 4); const to = `${y + 1}-03-31`;
  return { id: 'fy' + fy, label: 'FY ' + fy, from: `${y}-03-31`, to: to > asOf ? asOf : to };
};
export const periods = (fys          , asOf        )           => [
  { id: 'all', label: 'Since start', from: null, to: asOf },
  ...[...fys].sort().reverse().map((f) => fyBounds(f, asOf)),
  { id: '12m', label: 'Last 12 months', from: shiftMonths(asOf, -12), to: asOf },
];

                                                                                                                                          
                           
                                            
                                                                                                                  
                                                                                                                
 
                               
                                                                                                                                 
                                                                                                            
 
const blank = (period        , why        )           => ({ period, ok: false, why, startValue: 0, endValue: 0, netInvested: 0, gain: 0, xirr: null, dividends: 0, bench: [], path: [] });

/** Value on or before a date from the daily series; 0 when nothing was owned yet; null when the date lies before stored prices but money was already invested. */
export function valueAt(series                   , flows        , date        )                {
  if (series && series.length && date >= series[0].date) { let lo = 0, hi = series.length - 1, best = 0; while (lo <= hi) { const mid = (lo + hi) >> 1; if (series[mid].date <= date) { best = mid; lo = mid + 1; } else hi = mid - 1; } return series[best].value; }
  return flows.some((f) => f.date <= date) ? null : 0;
}

export function analyse(i              )           {
  const p = i.period, { flows } = i;
  const firstFlow = flows.map((f) => f.date).sort()[0];
  if (!firstFlow) return blank(p, 'No transactions yet.');
  const from = p.from ?? shiftDays(firstFlow, -1), to = p.to;
  let v0 = 0;
  if (p.from) {
    if (!i.seriesComplete) return blank(p, 'This period needs fund NAV history. Turn on fund history under Data.');
    const v = valueAt(i.series, flows, p.from);
    if (v === null) return blank(p, `Stored prices start ${i.series?.[0]?.date ?? 'later'}, after this period began, so the value at its start is unknown. Gains and tax for it are still shown.`);
    v0 = v;
  }
  let vend        ;
  if (to >= i.asOf) vend = i.heldNow;
  else { if (!i.seriesComplete) return blank(p, 'This period needs fund NAV history.'); const v = valueAt(i.series, flows, to); if (v === null) return blank(p, 'No stored prices for the end of this period.'); vend = v; }
  const inP = flows.filter((f) => f.date > from && f.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const net = inP.reduce((a, f) => a - f.amount, 0);                       // money put in (positive) minus taken out
  const cf         = [...(v0 > 0 ? [{ date: from, amount: -v0 }] : []), ...inP, { date: to, amount: vend }];
  const divs = i.divFlows.filter((f) => f.date > from && f.date <= to).reduce((a, f) => a + f.amount, 0);
  const bench                = [];
  for (const b of BENCHMARKS) {
    const look = navLookup(i.navs[b.id]);
    if (!i.navs[b.id]) { bench.push({ id: b.id, label: b.label, xirr: null, endValue: null, gap: null, why: 'history not loaded' }); continue; }
    let units = 0, bad                = null;
    if (v0 > 0) { const n0 = look(from); if (n0 === undefined) bad = 'index history starts later'; else units += v0 / n0; }
    for (const f of inP) { const n = look(f.date); if (n === undefined) { bad = 'index history starts later'; break; } units += -f.amount / n; }
    const nEnd = look(to);
    if (bad || nEnd === undefined) { bench.push({ id: b.id, label: b.label, xirr: null, endValue: null, gap: null, why: bad ?? 'no index value' }); continue; }
    const end = units * nEnd, bx = xirr([...(v0 > 0 ? [{ date: from, amount: -v0 }] : []), ...inP, { date: to, amount: end }]);
    bench.push({ id: b.id, label: b.label, xirr: bx, endValue: end, gap: null });
  }
  const mine = xirr(cf);
  for (const b of bench) b.gap = mine !== null && b.xirr !== null ? mine - b.xirr : null;

  // chart path: the portfolio's value against the same money in each index, from the first day we have values for
  const path                   = [];
  let pathNote                    ;
  if (i.series && i.seriesComplete) {
    const s0 = i.series[0].date, pf = p.from && p.from > s0 ? p.from : s0 > from ? s0 : from;
    const startV = valueAt(i.series, flows, pf);
    if (p.from === null && s0 > shiftDays(firstFlow, 10)) pathNote = `Value history starts ${s0} (stored prices); earlier months are not drawn.`;
    if (startV !== null) {
      const pts = i.series.filter((d) => d.date >= pf && d.date <= to);
      const fl = flows.filter((f) => f.date > pf && f.date <= to).sort((a, b) => a.date.localeCompare(b.date));
      const looks = BENCHMARKS.map((b) => [b.id, navLookup(i.navs[b.id])]         );
      const units                                     = {};
      for (const [id, l] of looks) { const n = l(pf); units[id] = startV === 0 ? 0 : n === undefined ? undefined : startV / n; }
      let k = 0;
      for (const d of pts) {
        while (k < fl.length && fl[k].date <= d.date) { for (const [id, l] of looks) { const n = l(fl[k].date); units[id] = units[id] === undefined ? undefined : n === undefined ? undefined : units[id]  + -fl[k].amount / n; } k++; }
        const idx                         = {};
        for (const [id, l] of looks) { const n = l(d.date); if (units[id] !== undefined && n !== undefined) idx[id] = units[id]  * n; }
        path.push({ date: d.date, value: d.value, idx });
      }
    }
  }
  return { period: p, ok: true, startValue: v0, endValue: vend, netInvested: net, gain: vend - v0 - net, xirr: mine, dividends: divs, bench, path, pathNote };
}

                                                                                                                                                                        
/** Simple Dietz return over a window: gain over the value at the start plus day-weighted money added. */
export function windowReturn(series            , flows        , a        , b        )                {
  const va = valueAt(series, flows, a), vb = valueAt(series, flows, b); if (va === null || vb === null) return null;
  const span = dayNo(b) - dayNo(a); if (span <= 0) return null;
  let cf = 0, w = 0; for (const f of flows) if (f.date > a && f.date <= b) { cf += -f.amount; w += -f.amount * ((dayNo(b) - dayNo(f.date)) / span); }
  const den = va + w; return den > 0 ? (vb - va - cf) / den : null;
}
export function momentum(series                   , complete         , flows        , asOf        , nav                 )           {
  const none = (note        )           => ({ r3: null, r3prev: null, idx3: null, label: 'Not enough history', note });
  if (!series || !complete) return none('Needs value history for every holding.');
  const a3 = shiftMonths(asOf, -3), a6 = shiftMonths(asOf, -6);
  const r3 = windowReturn(series, flows, a3, asOf), r3p = windowReturn(series, flows, a6, a3);
  const look = navLookup(nav), n0 = look(a3), n1 = look(asOf);
  const idx3 = n0 && n1 ? n1 / n0 - 1 : null;
  if (r3 === null || r3p === null) return { r3, r3prev: r3p, idx3, label: 'Not enough history', note: 'Needs six months of values.' };
  const d = r3 - r3p, label = d > 0.01 ? 'Gaining' : d < -0.01 ? 'Fading' : 'Steady';
  return { r3, r3prev: r3p, idx3, label, note: `Last 3 months ${(r3 * 100).toFixed(1)}% against ${(r3p * 100).toFixed(1)}% in the 3 months before.` };
}

                                                                                    
const pct1 = (x        ) => (x * 100).toFixed(1) + '%';
export function verdict(a          , benchId        , m          )          {
  if (!a.ok) return { text: a.why ?? 'Not available for this period.', tone: 'unknown' };
  const b = a.bench.find((x) => x.id === benchId);
  const rupees = (x        ) => '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');
  const head = `${a.period.label}: ${a.gain >= 0 ? 'up' : 'down'} ${rupees(a.gain)}${a.xirr !== null ? ` (${pct1(a.xirr)} a year)` : ''}.`;
  if (!b || b.gap === null) return { text: head + ' Index comparison not available yet.', tone: 'unknown' };
  const pts = Math.abs(b.gap * 100).toFixed(1);
  const rel = Math.abs(b.gap) < 0.005 ? `level with ${b.label}` : b.gap > 0 ? `${pts} points ahead of ${b.label}` : `${pts} points behind ${b.label}`;
  const mom = m.label === 'Not enough history' ? '' : ` Momentum: ${m.label.toLowerCase()}.`;
  return { text: `${head} ${rel[0].toUpperCase()}${rel.slice(1)}.${mom}`, tone: Math.abs(b.gap) < 0.005 ? 'flat' : b.gap > 0 ? 'good' : 'bad' };
}
