// Price history for the stock charts on the Strategies page: split-adjusted closes for the last 460 sessions of the names a strategy can show.
// Written by the nightly momentum-sleeve job from the series it already loads (no second load). Names: the 400 most traded over 60 sessions,
// plus every symbol found in the last dashboard file (scan lists and books). One shared date row, one close row per name, 2 decimals, null where no close.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const SESSIONS = 460, TOP = 400;
function symsIn(node, out) { if (Array.isArray(node)) for (const x of node) symsIn(x, out); else if (node && typeof node === 'object') { for (const [k, v] of Object.entries(node)) { if ((k === 'sym' || k === 'symbol') && typeof v === 'string') out.add(v); else symsIn(v, out); } } }
export function writeStockHist({ series, dates, t, file, dashboard = 'site/data/dashboard.json' }) {
  const from = Math.max(0, t - SESSIONS + 1), traded = [];
  for (const [sym, s] of series) { let sum = 0, n = 0; for (let i = Math.max(0, t - 59); i <= t; i++) { const v = s.c[i] * s.v[i]; if (v > 0) { sum += v; n++; } } if (n >= 30) traded.push([sym, sum / n]); }
  const pick = new Set(traded.sort((a, b) => b[1] - a[1]).slice(0, TOP).map((x) => x[0]));
  if (existsSync(dashboard)) { const used = new Set(); try { symsIn(JSON.parse(readFileSync(dashboard, 'utf8')), used); } catch { /* no dashboard yet */ } for (const s of used) if (series.has(s)) pick.add(s); }
  const s = {}; for (const sym of [...pick].sort()) { const c = series.get(sym).c, row = []; let any = false; for (let i = from; i <= t; i++) { const v = c[i]; if (v > 0) { row.push(Math.round(v * 100) / 100); any = true; } else row.push(null); } if (any) s[sym] = row; }
  const dir = file.slice(0, file.lastIndexOf('/')); mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ asOf: dates[t], dates: dates.slice(from, t + 1), s }) + '\n');
  return Object.keys(s).length;
}
