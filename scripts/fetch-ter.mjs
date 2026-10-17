// Scheme expense ratios (TER) from AMFI's TER page API: the newest TER per scheme from the latest month. Writes data/funds/ter.json (public data).
// The API returns one row per scheme per day; rows carry a scheme name and NSDL code (no AMFI code or ISIN), so fund-scores.mjs matches by name.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const B = 'https://www.amfiindia.com/api/populate-te-rdata-revised';
const SIZE = 50;
async function page(month, p) {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(`${B}?MF_ID=All&Month=${month}&strCat=-1&strType=-1&page=${p}&pageSize=${SIZE}`, { headers: UA, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(); const inner = j?.[0]?.data ?? j?.data ?? j; return Array.isArray(inner?.data) ? inner.data : []; }
    catch (e) { if (a === 2) throw e; await new Promise((r) => setTimeout(r, 1000 * (a + 1))); }
  }
}
const LOG = { start: new Date().toISOString() };
const finish = (code) => { mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/ter-log.json', JSON.stringify(LOG, null, 1) + '\n'); process.exit(code); };
process.on('uncaughtException', (e) => { LOG.error = String(e.message || e); finish(1); });
process.on('unhandledRejection', (e) => { LOG.error = String(e?.message || e); finish(1); });
const now = new Date(); let month = null;
for (let i = 0; i < 6 && !month; i++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); const m = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`; if ((await page(m, 1)).length) month = m; }
LOG.month = month;
if (!month) { LOG.error = 'no TER month found'; finish(1); }
const latest = new Map(); let n = 0, empty = false;
const take = (rows) => { for (const r of rows) { n++; const k = r.NSDLSchemeCode || r.Scheme_Name; const o = latest.get(k); if (!o || r.TER_Date > o.TER_Date) latest.set(k, r); } };
let next = 1; const workers = Array.from({ length: 4 }, async () => { while (!empty) { const p = next++; const rows = await page(month, p); if (!rows.length) { empty = true; break; } take(rows); if (p % 100 === 0) console.log('page', p, 'rows', n); } });
await Promise.all(workers);
console.log('TER rows', n, 'schemes', latest.size, 'month', month); LOG.rows = n; LOG.schemes = latest.size; LOG.lastPage = next;
if (latest.size < 500) { LOG.error = 'too few schemes'; finish(1); }
const num = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : null; };
const rows = [...latest.values()].map((r) => ({ n: r.Scheme_Name, c: r.SchemeCat_Desc, reg: num(r.R_TER), dir: num(r.D_TER), d: String(r.TER_Date).slice(0, 10) }));
mkdirSync('data/funds', { recursive: true });
LOG.ok = true; writeFileSync('data/funds/ter-log.json', JSON.stringify(LOG, null, 1) + '\n');
writeFileSync('data/funds/ter.json', JSON.stringify({ month, source: 'AMFI TER of MF schemes', rows }) + '\n');
