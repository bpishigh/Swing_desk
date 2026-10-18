// C-66 forward check: do momentum-list names do better inside the desk's setup geometry? Logs tonight's geometry candidates (data/india/scan/geometry.json) tagged by the month's momentum list,
// then scores matured entries: buy the next close, sell 20 sessions later, tiered cost, minus the equal-weight market. New data only; nothing trades or alerts.
// Usage: node scripts/momentum-forward.mjs india
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tierCost } from '../src/backtest/ind-base.ts';
if (process.argv[2] !== 'india') { console.error('usage: momentum-forward.mjs india'); process.exit(1); }
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), HOLD = 20;
const geo = existsSync('data/india/scan/geometry.json') ? R('data/india/scan/geometry.json') : null;
const SF = process.env.MF_FILE || 'data/india/momentum-forward.json', st = existsSync(SF) ? R(SF) : { startedAfter: process.env.MF_START || '2026-10-18', events: {}, lastLogged: {} };
const files = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort(), dates = files.map((f) => f.slice(0, 10));
const day = new Map(); const load = (i) => { if (!day.has(i)) day.set(i, R('data/india/bhav/' + files[i])); return day.get(i); };
const segs = R('data/india/segments.json').industry ?? {}, uni = Object.keys(segs);
// 1) log tonight's candidates
let added = 0;
if (geo && geo.asOf > st.startedAfter) {
  const mfile = `data/india/momentum/${geo.asOf.slice(0, 7)}.json`; const mom = existsSync(mfile) ? new Set(R(mfile).names) : null;
  const ti = dates.indexOf(geo.asOf);
  if (mom && ti >= 0) for (const r of geo.rows) {
    const key = r.sym + '|' + r.id, last = st.lastLogged[key] !== undefined ? dates.indexOf(st.lastLogged[key]) : -99;
    if (last >= 0 && ti - last < HOLD) continue;
    st.events[key + '|' + geo.asOf] = { sym: r.sym, id: r.id, cls: r.cls, mom: mom.has(r.sym), date: geo.asOf, trigger: r.trigger, stop: r.stop, limit: r.limit, basis: r.basis, width: r.width, room: r.room };
    st.lastLogged[key] = geo.asOf; added++;
  }
}
// 2) score matured entries
let matured = 0;
for (const ev of Object.values(st.events)) {
  if (ev.done) continue; const t = dates.indexOf(ev.date); if (t < 0 || t + 1 + HOLD >= dates.length) continue;
  const row = (i, s) => load(i).rows[s], c0 = row(t + 1, ev.sym)?.[5], c1 = row(t + 1 + HOLD, ev.sym)?.[5]; if (!(c0 > 0) || !(c1 > 0)) continue;
  const raw = c1 / c0 - 1; if (Math.abs(raw) > 0.6) { ev.done = true; ev.flag = 'possible corporate action; excluded'; continue; }
  let a = 0, n = 0; for (let i = t - 19; i <= t; i++) { const r = row(i, ev.sym); if (r && r[5] > 0 && r[6] >= 0) { a += r[5] * r[6]; n++; } }
  const cost = tierCost(n ? a / n : 0); let ms = 0, mn = 0; const d0 = load(t + 1).rows, d1 = load(t + 1 + HOLD).rows;
  for (const s of uni) { const x0 = d0[s]?.[5], x1 = d1[s]?.[5]; if (x0 > 0 && x1 > 0) { ms += Math.max(-0.5, Math.min(0.5, x1 / x0 - 1)); mn++; } }
  ev.exit = dates[t + 1 + HOLD]; ev.net = +(raw - cost).toFixed(4); ev.mkt = mn > 30 ? +(ms / mn).toFixed(4) : null; ev.done = true; matured++;
}
// 3) summary
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const all = Object.values(st.events), done = all.filter((e) => e.done && e.net !== undefined);
const grp = (name, f) => { const out = {}; for (const [side, mf] of [['momentum', (e) => e.mom], ['others', (e) => !e.mom]]) { const g = done.filter((e) => f(e) && mf(e)); out[side] = { matured: g.length, open: all.filter((e) => f(e) && mf(e) && !e.done).length, meanNet: g.length ? +mean(g.map((e) => e.net)).toFixed(4) : null, win: g.length ? +(g.filter((e) => e.net > 0).length / g.length).toFixed(3) : null, excess: g.length ? +mean(g.map((e) => e.net - (e.mkt ?? 0))).toFixed(4) : null }; }
  const m = {}, o = {}; for (const e of done.filter(f)) (e.mom ? m : o)[e.date.slice(0, 7)] = [...((e.mom ? m : o)[e.date.slice(0, 7)] || []), e.net]; const ks = Object.keys(m).filter((k) => o[k]), dl = ks.map((k) => mean(m[k]) - mean(o[k]));
  out.diffNet = out.momentum.meanNet !== null && out.others.meanNet !== null ? +(out.momentum.meanNet - out.others.meanNet).toFixed(4) : null; out.diffWin = out.momentum.win !== null && out.others.win !== null ? +(out.momentum.win - out.others.win).toFixed(3) : null; out.t = dl.length > 2 ? +(mean(dl) / (sd(dl) / Math.sqrt(dl.length))).toFixed(2) : null; return { group: name, ...out }; };
st.summary = { updated: new Date().toISOString().slice(0, 10), groups: [grp('valid + room under 3R (reading rule)', (e) => e.cls === 'valid' || e.cls === 'lowRoom'), grp('valid', (e) => e.cls === 'valid'), grp('room under 3R', (e) => e.cls === 'lowRoom'), grp('stop too wide', (e) => e.cls === 'tooWide')] };
writeFileSync(SF, JSON.stringify(st, null, 1) + '\n');
console.log(`logged ${added}, matured ${matured}, total ${all.length}, scored ${done.length}`);
for (const g of st.summary.groups) console.log(g.group.padEnd(38), 'momentum', JSON.stringify(g.momentum), 'others', JSON.stringify(g.others), 'diff', g.diffNet, g.diffWin, 't', g.t);
