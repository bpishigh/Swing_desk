// All-fund-types cross-group allocation back-test (Engine Rules C-100). Pure: grouped NAV series in, per-year result and pass/fail out. Nothing after each 1 Oct date is used to rank.
import { cagr, navOn,          } from './fundscore.js';
import { riskStats } from './fundrisk.js';

export const AT = { firstYear: 2015, lastYear: 2025, minFunds: 5, top: 3, passShare: 0.6, minYears: 5, worstYearSlack: 3, cashGroup: 'debt:Liquid' };
                                                                                  
                                                                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                         
const median = (a          )         => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusYear = (d        )         => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };

/** `weights` maps a class to its preset weight (classes missing or zero are left out of the preset and rescaled). */
export function allFundsTilt(members          , series                  , weights                        , cfg = AT)            {
  const dates = new Map                  (); for (const [k, nav] of series) dates.set(k, Object.keys(nav).sort());
  const years            = [], byType                         = {}, byGroup                         = {};
  for (let y = cfg.firstYear; y <= cfg.lastYear; y++) {
    const T = `${y}-10-01`, E = plusYear(T), per = new Map                                                                                   ();
    for (const m of members) {
      const nav = series.get(m.code), d = dates.get(m.code); if (!nav || !d) continue;
      const r3 = cagr(d, nav, T, 3), st = riskStats(nav, T), a = navOn(d, nav, T), b = navOn(d, nav, E);
      if (r3 === null || !st || !(a && b && a > 0)) continue;
      const e = per.get(m.group) ?? per.set(m.group, { cls: m.cls, type: m.type, r3: [], vol: [], fwd: [] }).get(m.group) ; e.r3.push(r3); e.vol.push(st.vol); e.fwd.push((b / a - 1) * 100);
    }
    const ok = [...per].filter(([, v]) => v.fwd.length >= cfg.minFunds).map(([g, v]) => ({ g, cls: v.cls, type: v.type, r3: median(v.r3), vol: median(v.vol), fwd: median(v.fwd) }));
    const cash = ok.find((o) => o.g === cfg.cashGroup); if (!cash || ok.length < cfg.top + 3) continue;
    const ranked = ok.filter((o) => o.g !== cfg.cashGroup && o.vol > 0).map((o) => ({ ...o, score: (o.r3 - cash.r3) / o.vol })).sort((a, b) => b.score - a.score || a.g.localeCompare(b.g));
    if (ranked.length < cfg.top) continue;
    const top = ranked.slice(0, cfg.top), tilt = top.reduce((a, o) => a + o.fwd, 0) / top.length;
    const clsRet = new Map                (); for (const c of new Set(ok.map((o) => o.cls))) clsRet.set(c, median(ok.filter((o) => o.cls === c).map((o) => o.fwd)));
    const live = Object.entries(weights).filter(([c, w]) => w > 0 && clsRet.has(c)), wSum = live.reduce((a, [, w]) => a + w, 0);
    if (!wSum || live.length < 3) continue;
    const preset = live.reduce((a, [c, w]) => a + (w / wSum) * clsRet.get(c) , 0), equal = ok.reduce((a, o) => a + o.fwd, 0) / ok.length;
    for (const o of top) { byType[o.type] = (byType[o.type] ?? 0) + 1; byGroup[o.g] = (byGroup[o.g] ?? 0) + 1; }
    years.push({ date: T, eligible: ok.length, picked: top.map((o) => o.g), tilt, preset, equal, exPreset: tilt - preset, exEqual: tilt - equal });
  }
  const counted = years.length, beatPreset = years.filter((y) => y.exPreset > 0).length, beatEqual = years.filter((y) => y.exEqual > 0).length;
  const medianExPreset = counted ? median(years.map((y) => y.exPreset)) : null, worstTilt = counted ? Math.min(...years.map((y) => y.tilt)) : null, worstPreset = counted ? Math.min(...years.map((y) => y.preset)) : null;
  const parts = { vsPreset: counted >= cfg.minYears && beatPreset / counted >= cfg.passShare, median: (medianExPreset ?? -1) > 0, worst: counted > 0 && worstTilt  >= worstPreset  - cfg.worstYearSlack, vsEqual: counted >= cfg.minYears && beatEqual / counted >= cfg.passShare };
  return { years, counted, beatPreset, beatEqual, medianExPreset, worstTilt, worstPreset, pickedByType: byType, pickedByGroup: byGroup, pass: parts.vsPreset && parts.median && parts.worst && parts.vsEqual, parts };
}
