// Probe 6: AMFI TER data call variants. Writes data/source-test/ter-probe.json.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const B = 'https://www.amfiindia.com';
const out = [];
const call = async (name, path) => { try { const r = await fetch(B + path, { headers: UA, signal: AbortSignal.timeout(40000) }); const b = Buffer.from(await r.arrayBuffer()); out.push({ name, path, status: r.status, type: r.headers.get('content-type'), bytes: b.length, head: b.slice(0, 500).toString('utf8').replace(/[^\x20-\x7e]/g, '.') }); } catch (e) { out.push({ name, path, error: String(e.message) }); } console.log(name, out[out.length - 1].status ?? out[out.length - 1].error); };
for (const y of ['2026', '2025', '2025-26', '2026-27', '2025-2026']) await call('month ' + y, `/api/populate-ter-month?year=${y}`);
await call('years', '/api/populate-ter-year');
await call('years2', '/api/populate-te-ryear');
for (const m of ['10', '9', '202610', '2026-10', 'October 2026']) await call('data m=' + m, `/api/populate-te-rdata-revised?MF_ID=All&Month=${encodeURIComponent(m)}&strCat=-1&strType=-1&page=1&pageSize=3`);
await call('excel', '/api/populate-te-rdata-revised?MF_ID=All&Month=10&strCat=-1&strType=-1&excel=true');
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/ter-probe.json', JSON.stringify(out, null, 1) + '\n');
