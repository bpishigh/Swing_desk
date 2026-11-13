// Filings loader step 4 (docs/FILINGS_LOADER_SPEC.md): walks NSE's market-wide integrated-filing results list for the given quarter ends, parses each XBRL file, links it to an entity and saves the facts.
// Usage (runs on the GitHub runner; the workspace shell cannot reach NSE): node scripts/backfill-filings.mjs --periods=31-Mar-2026,31-Dec-2025 [--limit=N]
// Writes data/india/filings/<entity-id>.json.gz (merged by source URL) and data/india/filings-coverage.json (one block per period). Missing is missing: a file that does not parse is counted, never stored as zero.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import { parseResultsXbrl } from '../src/ingest/filings-parse.ts';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const TOPUP = process.argv.includes('--topup');   // Batch A: filings already stored get the extra figures (extra) added, no new rows
const periods = arg('periods', '31-Mar-2026').split(',').filter(Boolean), LIMIT = Number(arg('limit', '0')) || Infinity, CONC = Number(arg("conc", "2"));
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { ...UA, referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u, h = UA) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(90000) }); if (r.status === 200) return { status: 200, t: await r.text() }; if (r.status === 404) return { status: 404, t: '' }; } catch {} await sleep(1500 * (k + 1)); } return { status: 0, t: '' }; };
const arr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : j.data || []; } catch { return []; } };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const isoDate = (s) => { const m = String(s || '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/); return m ? `${m[3]}-${String(MON[m[2].toUpperCase()] + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const isoTime = (s) => { const m = String(s || '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d\d):(\d\d):(\d\d)/); return m ? `${m[3]}-${String(MON[m[2].toUpperCase()] + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4]}:${m[5]}:${m[6]}+05:30` : isoDate(s); };   // NSE broadcast times are India time
const maps = JSON.parse(readFileSync('settings/filings-tags.json', 'utf8'));
const ent = JSON.parse(readFileSync('data/india/entities.json', 'utf8')).entities, bySymbol = new Map();
for (const e of ent) for (const u of e.symbols) { const a = bySymbol.get(u.symbol) || []; a.push([u, e.id]); bySymbol.set(u.symbol, a); }
const entityOf = (symbol, date) => { const a = bySymbol.get(symbol); if (!a) return null; const hit = a.find(([u]) => (u.from == null || u.from <= date) && (u.to == null || u.to >= date)) || a[a.length - 1]; return hit[1]; };
mkdirSync('data/india/filings', { recursive: true });
const covPath = 'data/india/filings-coverage.json', cov = existsSync(covPath) ? JSON.parse(readFileSync(covPath, 'utf8')) : { note: 'Per quarter: how many filings the NSE list holds and how many parsed with each field. Written by scripts/backfill-filings.mjs.', periods: {} };
const TYPE = encodeURIComponent('Integrated Filing- Financials'), fetched = new Date().toISOString().slice(0, 10);
const store = new Map();   // entity -> { entity, results: [] }
const load = (id) => { if (store.has(id)) return store.get(id); const p = `data/india/filings/${id}.json.gz`; const o = existsSync(p) ? JSON.parse(gunzipSync(readFileSync(p))) : { entity: id, results: [] }; store.set(id, o); return o; };
const flush = () => { for (const [id, o] of store) { for (const k of [...new Set(o.results.map((y) => `${y.period}|${y.basis}`))]) { const g = o.results.filter((y) => `${y.period}|${y.basis}` === k).sort((a, b) => (a.asOf < b.asOf ? -1 : 1)); g.forEach((y, n) => { y.revision = n; }); } o.results.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : a.asOf < b.asOf ? -1 : 1)); writeFileSync(`data/india/filings/${id}.json.gz`, gzipSync(JSON.stringify(o))); }  writeFileSync(covPath, JSON.stringify(cov, null, 1) + '\n'); };
for (const period of periods) {
  const pe = isoDate(period); let all = [];
  for (let p = 1; p <= 30; p++) { const a = arr((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&period_ended=${period}&page=${p}&size=500`, NSEH)).t); if (!a.length) break; all = all.concat(a); await sleep(300); }
  // Quarters before the integrated filing (before Mar 2025): the older market-wide list, queried by filing window (quarter end + 1 day to +125 days, in 30-day steps), rows kept when they are the quarter asked for and carry an XBRL link.
  if (all.length === 0 && pe < '2025-03-31') {
    const seen = new Set(), d0 = new Date(pe + 'T00:00:00Z'), fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
    for (let off = 1; off < 125; off += 30) {
      const a = new Date(d0.getTime() + off * 864e5), b = new Date(d0.getTime() + Math.min(off + 29, 125) * 864e5);
      const rows = arr((await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=${fmt(a)}&to_date=${fmt(b)}`, NSEH)).t); await sleep(500);
      for (const r of rows) { if (!/^https?:/.test(r.xbrl || '') || isoDate(r.toDate) !== pe || seen.has(r.xbrl)) continue; if (/^cumulative$/i.test(r.cumulative || '')) continue; seen.add(r.xbrl); all.push({ symbol: r.symbol, xbrl: r.xbrl, broadcast_Date: r.broadCastDate || r.filingDate, consolidated: r.consolidated, type_Sub: 'Original' }); }
    }
  }
  const recs = all.slice(0, LIMIT), c = { listed: all.length, attempted: recs.length, parsed: 0, fetchFailed: 0, parseFailed: 0, unmapped: 0, families: {}, missingField: { revenue: 0, pbt: 0, pat: 0, eps: 0 }, periodMismatch: 0, errors: {}, unmappedSymbols: [] };
  const countExtra = (e) => { c.extraCount = c.extraCount || {}; for (const part of ['q', 'bs', 'cf']) for (const k of Object.keys(e[part] || {})) c.extraCount[`${part}.${k}`] = (c.extraCount[`${part}.${k}`] || 0) + 1; };
  let i = 0;
  const worker = async () => { while (i < recs.length) {
    const rec = recs[i++]; const pre = entityOf(rec.symbol, pe); const have = pre ? load(pre).results.find((y) => y.source === rec.xbrl) : null;
    if (have && !(TOPUP && (!have.extra || !have.asOf))) { c.alreadyStored = (c.alreadyStored || 0) + 1; c.parsed++; continue; }   // resume: a filing already stored is not fetched again (top-up mode refetches only those without extra)
    if (have && TOPUP) { const r0 = await get(rec.xbrl); if (r0.status !== 200) { c.fetchFailed++; continue; } const x0 = parseResultsXbrl(r0.t, maps); if (!x0.ok) { c.parseFailed++; continue; } have.extra = x0.extra; if (!have.asOf) { have.asOf = isoTime(rec.broadcast_Date || rec.revised_Date); c.asOfRepaired = (c.asOfRepaired || 0) + 1; } c.toppedUp = (c.toppedUp || 0) + 1; countExtra(x0.extra); c.parsed++; await sleep(150); continue; }   // resume: a filing already stored is not fetched again
    const r = await get(rec.xbrl); if (r.status !== 200) { c.fetchFailed++; continue; }
    const x = parseResultsXbrl(r.t, maps); if (!x.ok) { c.parseFailed++; c.errors[x.error] = (c.errors[x.error] || 0) + 1; continue; }
    if (x.periodEnd && x.periodEnd !== pe) c.periodMismatch++;
    const id = entityOf(rec.symbol || x.symbol, pe); if (!id) { c.unmapped++; if (c.unmappedSymbols.length < 40) c.unmappedSymbols.push(rec.symbol || x.symbol); continue; }
    c.parsed++; countExtra(x.extra); c.families[x.family] = (c.families[x.family] || 0) + 1; for (const k of x.missing) c.missingField[k]++;
    const o = load(id), src = rec.xbrl; if (o.results.some((y) => y.source === src)) continue;
    o.results.push({ period: x.periodEnd || pe, basis: x.basis || (/^Consolidated/i.test(rec.consolidated) ? 'consolidated' : 'standalone'), asOf: isoTime(rec.broadcast_Date || rec.revised_Date), original: /^Original/i.test(rec.type_Sub || 'Original'), format: x.family, fields: x.quarter, ytd: x.ytd, extra: x.extra, audited: x.audited, rounding: x.rounding, boardMeeting: x.boardMeeting, source: src, fetched });
    await sleep(150); } };
  await Promise.all(Array.from({ length: CONC }, worker));
  if (TOPUP) { const k = isoDate(period); cov.periods[k] = { ...(cov.periods[k] || {}), topup: { ...c, at: new Date().toISOString() } }; } else cov.periods[isoDate(period)] = { ...c, at: new Date().toISOString() };   // top-up keeps the original coverage block and adds its own
  flush();
  if (process.env.COMMIT_EACH === '1') { try { execSync('git add data/india/filings data/india/filings-coverage.json && git commit -q -m "backfill-filings: ' + period + '" && (git pull -q --rebase origin main; git push -q origin HEAD:main)', { stdio: 'inherit' }); } catch (e) { console.log('commit step failed, continuing: ' + String(e).slice(0, 100)); } }
  console.log(period, JSON.stringify({ listed: c.listed, parsed: c.parsed, fetchFailed: c.fetchFailed, parseFailed: c.parseFailed, unmapped: c.unmapped, families: c.families }));
}
