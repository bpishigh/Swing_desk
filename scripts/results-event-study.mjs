// Strong quarterly results event study (docs/replay/RESULTS-EVENT-PREREG.md).
// Usage: node --max-old-space-size=7000 scripts/results-event-study.mjs --from=2018-06-01 --to=2021-12-31 --tag=discovery
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const FROM = arg('from', '2018-06-01'), TO = arg('to', '2021-12-31'), TAG = arg('tag', 'discovery'), OUT = 'docs/replay';
const GATE_ARG = arg('gate', 'none');
const COMBO = arg('combo', '').split(',').filter(Boolean), DIRS = arg('dir', '').split(',').filter(Boolean).map(Number);
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const raw = [];
for (const dir of ['bhav-hist', 'bhav-pre2020']) for (const f of readdirSync('data/india/' + dir).filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync(`data/india/${dir}/${f}`))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
raw.sort((a, b) => (a.date < b.date ? -1 : 1)); const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
const actions = [...R('data/india/corp-actions-history-pre2019.json', []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date), N = dates.length;
const eq = new Set(); for (const d of uniq) for (const [s, r] of Object.entries(d.rows)) if (r[0] === 'EQ') eq.add(s);
const series = buildHistories(days, res.splits, eq).series; const syms = [...series.keys()];
const firstIdx = new Map(); for (let i = 0; i < N; i++) for (const r of days[i].rows) if (!firstIdx.has(r[0])) firstIdx.set(r[0], i);
const FUND = process.argv.includes('--fund');
const oAdj = (sym, i) => { const r = uniq[i]?.rows?.[sym], c = series.get(sym)?.c[i]; return r && r[2] > 0 && r[5] > 0 && c > 0 ? (r[2] * c) / r[5] : NaN; };   // open on the same split-adjusted scale as the closes
const FIL = new Map(); if (FUND) for (const f of readdirSync('data/india/filings').filter((x) => x.endsWith('.json.gz'))) { try { const j = JSON.parse(gunzipSync(readFileSync('data/india/filings/' + f))); FIL.set(j.entity ?? f.replace('.json.gz', ''), j.results ?? []); } catch {} }
const eom = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(), addM = (p, k) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}-${String(eom(y, m)).padStart(2, '0')}`; };
function fund(sym, D) {
  const rs = FIL.get(sym); if (!rs) return {};
  const by = new Map();
  for (const r of rs) { if (!r.original || !r.asOf || r.asOf.slice(0, 10) > D) continue; const cur = by.get(r.period); if (!cur || (r.basis === 'consolidated' && cur.basis !== 'consolidated') || (r.basis === cur.basis && r.asOf < cur.asOf)) by.set(r.period, r); }
  const per = [...by.keys()].sort(); if (!per.length) return {}; const q0 = per.at(-1); if ((new Date(D) - new Date(q0)) / 86400000 > 150) return {};
  const g = (p, fld) => { const a = by.get(p)?.fields?.[fld], b = by.get(addM(p, -12))?.fields?.[fld]; return a != null && b > 0 ? a / b - 1 : NaN; };
  const q1 = addM(q0, -3), out = {};
  const r0 = g(q0, 'revenue'), r1 = g(q1, 'revenue'), p0 = g(q0, 'pat'), p1 = g(q1, 'pat');
  out.revYoY = r0; out.patYoY = p0; out.revAccel = r0 - r1; out.patAccel = p0 - p1;
  const m = (p) => { const f = by.get(p)?.fields; return f?.revenue > 0 && f.pbt != null ? f.pbt / f.revenue : NaN; }; out.marginChg = m(q0) - m(addM(q0, -12));
  return out;
}


const bse = {}, nif = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['BSE 500'] ?? {})) if (v?.[3] > 0) bse[d] = v[3]; for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) if (v?.[3] > 0) nif[d] = v[3]; }
const join = Object.keys(nif).sort().find((d) => bse[d] > 0), kk = bse[join] / nif[join], idxd = {}; for (const d of Object.keys(bse)) if (d < join) idxd[d] = bse[d]; for (const d of Object.keys(nif)) idxd[d] = nif[d] * kk;
const ik = Object.keys(idxd).sort(), ia = (D) => { let lo = 0, hi = ik.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ik[m] <= D) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
const dIdx = new Map(dates.map((d, i) => [d, i])); const nextIdx = (D) => { let lo = 0, hi = N - 1, a = N; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] > D) { a = m; hi = m - 1; } else lo = m + 1; } return a; };
const tvAt = (s, a, b) => { let x = 0, n = 0; for (let i = a; i <= b; i++) if (s.c[i] > 0 && s.v[i] >= 0) { x += s.c[i] * s.v[i]; n++; } return n >= (b - a + 1) * 0.7 ? x / n : NaN; };
const ev = [];
for (const [sym, rs] of FIL) {
  const s = series.get(sym); if (!s) continue;
  const seenP = new Set();
  for (const r of [...rs].filter((x) => x.original && x.asOf).sort((a, b) => (a.asOf < b.asOf ? -1 : 1))) {
    const A = r.asOf.slice(0, 10); if (A < FROM || A > TO) continue; if (seenP.has(r.period)) continue; seenP.add(r.period);
    const m = fund(sym, A); if (!Number.isFinite(m.revYoY) || !Number.isFinite(m.patYoY) || !Number.isFinite(m.revAccel)) continue;
    const t = nextIdx(A); if (t >= N - 1 || t < 30) continue;
    const tv = tvAt(s, t - 21, t - 1); if (!(tv >= 2e7)) continue;
    const ent = oAdj(sym, t); if (!(ent > 0)) continue;
    const out = {}; for (const h of [60, 120, 250]) { const j = t + h; if (j > N - 1) { out[h] = null; continue; } let px = NaN; for (let k = j; k > t; k--) if (s.c[k] > 0) { px = s.c[k]; break; } const b0 = idxd[ik[ia(dates[t])]], b1 = idxd[ik[ia(dates[j])]]; out[h] = Number.isFinite(px) ? px / ent - 1 - 0.013 - (b1 / b0 - 1) : null; }
    ev.push({ sym, A, y: A.slice(0, 4), sig: m.revYoY >= 0.2 && m.patYoY >= 0.5 && m.revAccel > 0, out });
  }
}
const mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; }, med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; };
const pc = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const grp = (arr, h) => ({ n: arr.length, nh: arr.filter((e) => e.out[h] != null).length, mean: mean(arr.map((e) => e.out[h])), med: med(arr.map((e) => e.out[h])), win: arr.filter((e) => e.out[h] > 0).length / Math.max(1, arr.filter((e) => e.out[h] != null).length) });
const sig = ev.filter((e) => e.sig), ctl = ev.filter((e) => !e.sig), years = [...new Set(ev.map((e) => e.y))].sort();
let md = `# Strong results event study, ${arg('tag', 'discovery')} (${FROM}..${TO})\n\nRule: docs/replay/RESULTS-EVENT-PREREG.md. ${ev.length} events, ${sig.length} signal, ${ctl.length} control. Net excess return over the Nifty 500 after 1.3% cost.\n\n| horizon | group | events with outcome | mean excess | median excess | beat index |\n|---|---|---|---|---|---|\n`;
const resO = {};
for (const h of [60, 120, 250]) for (const [name, arr] of [['signal', sig], ['control', ctl]]) { const g = grp(arr, h); resO[`${name}${h}`] = g; md += `| ${h} | ${name} | ${g.nh} | ${pc(g.mean)} | ${pc(g.med)} | ${pc(g.win)} |\n`; }
md += `\n## By year at 60 sessions\n\n| year | signal n | signal mean excess | control n | control mean excess |\n|---|---|---|---|---|\n` + years.map((y) => { const a = grp(sig.filter((e) => e.y === y), 60), b = grp(ctl.filter((e) => e.y === y), 60); return `| ${y} | ${a.nh} | ${pc(a.mean)} | ${b.nh} | ${pc(b.mean)} |`; }).join('\n') + '\n';
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/RESULTS-EVENT-${arg('tag', 'discovery')}.md`, md); writeFileSync(`${OUT}/RESULTS-EVENT-${arg('tag', 'discovery')}.json`, JSON.stringify({ res: resO, n: ev.length })); console.log(md);
