// One-off probe (20 Oct 2026): can BSE's public endpoints give announced results (board meeting) dates, as a second source beside NSE? Writes data/source-test/bse-results-probe.json.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', origin: 'https://www.bseindia.com', referer: 'https://www.bseindia.com/' };
const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''), to = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
const B = 'https://api.bseindia.com/BseIndiaAPI/api';
const tries = [
  ['boardmeetings-a', `${B}/Corpforthresults/w?scripcode=&Fdate=${today}&TDate=${to}&Purposecode=P1&Segment=0&industry=`],
  ['boardmeetings-b', `${B}/BoardMeetings/w?strCat=-1&strPrevDate=${today}&strScrip=&strSearch=S&strToDate=${to}&strType=C`],
  ['calendar-results', `${B}/Corpforthresults/w?scripcode=500325`],
  ['corp-actions-forthcoming', `${B}/DefaultData/w?Fdate=${today}&Purposecode=&TDate=${to}&ddlcategorys=E&ddlindustrys=&scripcode=&segment=0&strSearch=S`],
];
const out = { ranAt: new Date().toISOString(), tries: [] };
for (const [name, url] of tries) {
  const t = { name, url }; try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }); t.status = r.status; t.type = r.headers.get('content-type'); const x = await r.text(); t.bytes = x.length; t.head = x.slice(0, 700); try { const j = JSON.parse(x); t.json = Array.isArray(j) ? { array: j.length, keys: Object.keys(j[0] ?? {}) } : { keys: Object.keys(j).slice(0, 12), table: Array.isArray(j.Table) ? j.Table.length : undefined, sample: Array.isArray(j.Table) ? j.Table.slice(0, 3) : undefined }; } catch {} } catch (e) { t.error = String(e.message ?? e); }
  out.tries.push(t);
}
mkdirSync('data/source-test', { recursive: true }); writeFileSync('data/source-test/bse-results-probe.json', JSON.stringify(out, null, 1) + '\n'); console.log(out.tries.map((t) => `${t.name}: ${t.status ?? t.error} ${t.bytes ?? ''}`).join('\n'));
