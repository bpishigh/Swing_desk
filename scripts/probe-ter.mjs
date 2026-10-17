// Probe: where can the Actions runner get scheme expense ratios (TER) and index total-return levels? Writes data/source-test/ter-probe.json (first bytes of each reply).
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*' };
const d = new Date(Date.now() - 2 * 86400000), mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
const dmy = `${String(d.getUTCDate()).padStart(2, '0')}-${mon}-${d.getUTCFullYear()}`;
const tests = [
  ['amfi TER api (revised)', `https://www.amfiindia.com/api/populate-te-rdata-revised?MF_ID=-1&strCat=-1&strType=1&date=${dmy}`],
  ['amfi TER api (old)', `https://www.amfiindia.com/modules/PopulateTERData?MF_ID=-1&strCat=-1&strType=1&date=${dmy}`],
  ['amfi TER page', 'https://www.amfiindia.com/otherdata/ter-of-mf-schemes'],
  ['amfi TER download', `https://www.amfiindia.com/api/ter-of-mf-schemes-download?date=${dmy}`],
  ['niftyindices TRI', 'https://www.niftyindices.com/Index_Data/Historical_Data.aspx'],
  ['mfapi scheme (has no TER)', 'https://api.mfapi.in/mf/120503/latest'],
  ['nse indices live', 'https://www.nseindia.com/api/allIndices'],
];
const out = [];
for (const [name, url] of tests) {
  try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }); const t = await r.text(); out.push({ name, url, status: r.status, type: r.headers.get('content-type'), bytes: t.length, head: t.slice(0, 1200) }); }
  catch (e) { out.push({ name, url, error: String(e.message || e) }); }
  console.log(name, out[out.length - 1].status ?? out[out.length - 1].error);
}
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/ter-probe.json', JSON.stringify(out, null, 1) + '\n');
