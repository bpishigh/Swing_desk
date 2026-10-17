// Probe: where can the Actions runner get scheme expense ratios (TER) and index total-return levels? Writes data/source-test/ter-probe.json (first bytes of each reply).
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*' };
const d = new Date(Date.now() - 2 * 86400000), mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
const dmy = `${String(d.getUTCDate()).padStart(2, '0')}-${mon}-${d.getUTCFullYear()}`;
const dates = ['16-Oct-2026', '15-Oct-2026', '30-Sep-2026'];
const tests = [];
for (const dt of dates) for (const q of ['MF_ID=-1&strCat=-1&strType=1', 'MF_ID=-1&strCat=-1&strType=1&page=1&pageSize=5000', 'strType=1&MF_ID=-1&strCat=-1&pageSize=100']) tests.push([`TER ${dt} ${q.slice(-24)}`, `https://www.amfiindia.com/api/populate-te-rdata-revised?${q}&date=${dt}`]);
tests.push(['TER no date', 'https://www.amfiindia.com/api/populate-te-rdata-revised?MF_ID=-1&strCat=-1&strType=1&pageSize=100']);
tests.push(['TER other path', 'https://www.amfiindia.com/api/ter-of-mf-schemes']);
tests.push(['TER other path 2', 'https://www.amfiindia.com/api/populate-ter-data']);
tests.push(['page1', 'https://www.amfiindia.com/otherdata/ter-of-mf-scheme']);
tests.push(['page2', 'https://www.amfiindia.com/investor/ter-of-mf-schemes']);

const out = [];
for (const [name, url] of tests) {
  try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }); const t = await r.text(); out.push({ name, url, status: r.status, type: r.headers.get('content-type'), bytes: t.length, head: t.slice(0, 700) }); }
  catch (e) { out.push({ name, url, error: String(e.message || e) }); }
  console.log(name, out[out.length - 1].status ?? out[out.length - 1].error);
}
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/ter-probe.json', JSON.stringify(out, null, 1) + '\n');
