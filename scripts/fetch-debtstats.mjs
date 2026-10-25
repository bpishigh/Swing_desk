// Monthly debt-fund statistics (scope K5): yield to maturity, average maturity, modified duration and credit quality for the Direct debt funds in data/funds/scores.json, read from sharpely.in's public holdings pages (robots.txt allows it). A fund is matched to a page only when exactly one page fits its name; no guesses.
// Writes data/funds/debtstats.json (by ISIN) and debtstats-log.json. Public data only.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseDebtPage, debtKey } from '../src/pm/debtstats.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'text/html,application/xml,*/*' };
const get = async (u) => { for (let i = 0; i < 2; i++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} await new Promise((r) => setTimeout(r, 1500)); } return null; };
const funds = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'debt' && f.isin);
const sm = await get('https://sharpely.in/sitemap-mf.xml'); if (!sm) { console.error('sitemap unreachable: keeping the previous file'); process.exit(1); }
const pages = new Map(); for (const m of sm.matchAll(/<loc>(https:\/\/sharpely\.in\/mutual-funds\/([^/<]+)\/\d+)<\/loc>/g)) { const k = debtKey(m[2]); (pages.get(k) ?? pages.set(k, []).get(k)).push(m[1]); }
const prev = existsSync('data/funds/debtstats.json') ? JSON.parse(readFileSync('data/funds/debtstats.json', 'utf8')) : { funds: {} };
const out = { asOf: new Date().toISOString().slice(0, 10), source: 'sharpely.in fund holdings pages (public)', funds: {} }, LOG = { start: new Date().toISOString(), wanted: funds.length, noPage: [], ambiguous: [], noStats: [], ok: 0, kept: 0 };
let i = 0;
const one = async (f) => {
  const c = pages.get(debtKey(f.name));
  if (!c) { LOG.noPage.push(f.name); return; } if (c.length > 1) { LOG.ambiguous.push(f.name); return; }
  const html = await get(c[0] + '/holdings'), s = html ? parseDebtPage(html) : null;
  if (!s) { LOG.noStats.push(f.name); if (prev.funds?.[f.isin]) { out.funds[f.isin] = prev.funds[f.isin]; LOG.kept++; } return; }
  out.funds[f.isin] = { ...s, readOn: out.asOf }; LOG.ok++;
};
await Promise.all(Array.from({ length: 3 }, async () => { while (i < funds.length) { await one(funds[i++]).catch(() => {}); await new Promise((r) => setTimeout(r, 400)); } }));
LOG.end = new Date().toISOString(); const cut = (a) => a.slice(0, 30);
writeFileSync('data/funds/debtstats-log.json', JSON.stringify({ ...LOG, noPageN: LOG.noPage.length, ambiguousN: LOG.ambiguous.length, noStatsN: LOG.noStats.length, noPage: cut(LOG.noPage), ambiguous: cut(LOG.ambiguous), noStats: cut(LOG.noStats) }, null, 1) + '\n');
if (LOG.ok < funds.length * 0.4) { console.error(`only ${LOG.ok} of ${funds.length} read: keeping the previous file`); process.exit(1); }
writeFileSync('data/funds/debtstats.json', JSON.stringify(out) + '\n');
console.log(JSON.stringify({ ok: LOG.ok, noPage: LOG.noPage.length, ambiguous: LOG.ambiguous.length, noStats: LOG.noStats.length }));
