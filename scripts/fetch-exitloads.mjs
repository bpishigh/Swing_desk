// Monthly: the exit-load wording of every Direct fund in data/funds/scores.json, read from the sharpely.in fund page (public structured data), parsed into days, percent, tiers and free share. Writes data/funds/exitloads-auto.json (by ISIN) and exitloads-log.json. A typed record in the private repo always overrides this.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseExitNote } from '../src/pm/exitnote.ts';
import { intlKey } from '../src/pm/intlfacts.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'text/html,application/xml,*/*' };
const get = async (u) => { for (let i = 0; i < 2; i++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} } return null; };
// Every Direct plan on the AMFI list (not only the scored funds: a fund you hold may be unscored). Growth and IDCW lines of one scheme share a page, so they are grouped.
const am = JSON.parse(readFileSync('data/rules/amfi-schemes.json', 'utf8')), ci = Object.fromEntries(am.cols.map((c, i) => [c, i]));
const OPT = /\b(growth|idcw|payout|reinvestment|reinvest|dividend|bonus|income distribution cum capital withdrawal|capital withdrawal|option|plan|direct|monthly|quarterly|weekly|daily|annual|half yearly|fortnightly|periodic|regular|of|and)\b/gi;
const groups = new Map();
for (const r of am.rows) { if (r[ci.plan] !== 'Direct Plan' || !r[ci.isin1] || r[ci.isin1] === '-') continue; const k = intlKey(r[ci.name].replace(OPT, ' ')); (groups.get(k) ?? groups.set(k, { names: [], key: k }).get(k)).names.push(r[ci.name]); }
const funds = [...groups.values()];
const sm = await get('https://sharpely.in/sitemap-mf.xml'); if (!sm) { console.error('sitemap unreachable: keeping the previous file'); process.exit(1); }
const pages = new Map(); for (const m of sm.matchAll(/<loc>(https:\/\/sharpely\.in\/mutual-funds\/([^/<]+)\/\d+)<\/loc>/g)) { const k = intlKey(m[2].replace(OPT, ' ')); (pages.get(k) ?? pages.set(k, []).get(k)).push(m[1]); }
const prev = existsSync('data/funds/exitloads-auto.json') ? JSON.parse(readFileSync('data/funds/exitloads-auto.json', 'utf8')) : { groups: [] }, prevBy = new Map((prev.groups ?? []).map((g) => [g.names[0], g]));
const out = { asOf: new Date().toISOString().slice(0, 10), source: 'sharpely.in fund pages (public); not the scheme documents', groups: [] }, LOG = { start: new Date().toISOString(), wanted: funds.length, parsed: 0, unparsed: 0, none: 0, kept: 0, noPage: 0, ambiguous: 0, noNote: 0, unparsedSamples: [] };
const note = (html) => { const m = /\\?"exit_load_note\\?":\\?"((?:[^"\\]|\\\\.|\\(?!"))*)/.exec(html); return m ? m[1].replace(/\\\\r|\\\\n/g, ' ').replace(/\\"/g, '"').trim() : null; };
let i = 0;
const one = async (f) => {
  const c = pages.get(f.key);
  if (!c) { LOG.noPage++; return; } if (c.length > 1) { LOG.ambiguous++; return; }
  const html = await get(c[0]); if (!html) { const o = prevBy.get(f.names[0]); if (o) { out.groups.push(o); LOG.kept++; } return; }
  const n = note(html); if (n === null) { LOG.noNote++; return; }
  const p = parseExitNote(n); out.groups.push({ names: f.names, note: n.slice(0, 400), readOn: out.asOf, ...(p.load ? { load: p.load } : {}), ...(p.partial ? { partial: true } : {}) });
  if (!p.load) { LOG.unparsed++; if (LOG.unparsedSamples.length < 40) LOG.unparsedSamples.push(n.slice(0, 160)); } else if (p.load.pct === 0) LOG.none++; else LOG.parsed++;
};
await Promise.all(Array.from({ length: 4 }, async () => { while (i < funds.length) { await one(funds[i++]).catch(() => {}); await new Promise((r) => setTimeout(r, 300)); } }));
LOG.end = new Date().toISOString();
writeFileSync('data/funds/exitloads-log.json', JSON.stringify(LOG, null, 1) + '\n');
const got = out.groups.length; if (got < funds.length * 0.3) { console.error(`only ${got} of ${funds.length} read: keeping the previous file`); process.exit(1); }
writeFileSync('data/funds/exitloads-auto.json', JSON.stringify(out) + '\n');
console.log(JSON.stringify({ ...LOG, unparsedSamples: undefined }));
