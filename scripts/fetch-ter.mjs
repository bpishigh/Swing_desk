// Scheme expense ratios (TER) from AMFI's own TER page API, newest month that has data. Writes data/funds/ter-raw.json (public data). Usage: node scripts/fetch-ter.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const B = 'https://www.amfiindia.com/api/populate-te-rdata-revised';
const get = async (q) => { const r = await fetch(`${B}?${q}`, { headers: UA, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error('status ' + r.status); return r.json(); };
const now = new Date(); const months = []; for (let i = 0; i < 8; i++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); months.push(`${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`); }
const log = []; let found = null;
for (const month of months) for (const type of ['-1', '1', '2', '3']) {
  try {
    const j = await get(`MF_ID=All&Month=${month}&strCat=-1&strType=${type}&page=1&pageSize=50`);
    const inner = j?.[0]?.data ?? j?.data ?? j; const rows = Array.isArray(inner?.data) ? inner.data : Array.isArray(inner) ? inner : [];
    const meta = inner?.meta ?? null; log.push({ month, type, n: rows.length, meta });
    if (rows.length) { found = { month, type, meta, sample: rows.slice(0, 3) }; break; }
  } catch (e) { log.push({ month, type, error: e.message }); }
  if (found) break;
}
mkdirSync('data/funds', { recursive: true });
if (!found) { writeFileSync('data/funds/ter-probe.json', JSON.stringify({ log }, null, 1) + '\n'); console.log('no TER data found'); process.exit(0); }
// pull every page for that month/type
const all = []; const size = 500; const total = found.meta?.total ?? 0; const pages = Math.max(1, Math.ceil(total / size));
for (let p = 1; p <= pages; p++) { const j = await get(`MF_ID=All&Month=${found.month}&strCat=-1&strType=${found.type}&page=${p}&pageSize=${size}`); const inner = j?.[0]?.data ?? j?.data ?? j; all.push(...(Array.isArray(inner?.data) ? inner.data : [])); }
writeFileSync('data/funds/ter-probe.json', JSON.stringify({ log, found: { ...found, got: all.length } }, null, 1) + '\n');
writeFileSync('data/funds/ter-raw.json', JSON.stringify({ month: found.month, type: found.type, rows: all }) + '\n');
console.log('TER rows', all.length, 'month', found.month);
