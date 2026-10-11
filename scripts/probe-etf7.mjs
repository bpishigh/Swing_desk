// One-off: which way of asking NSE for a circular PDF returns a real PDF instead of a block page.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const base = 'https://www.nseindia.com';
const w = await fetch(base, { headers: { 'user-agent': UA } }); const cookie = (w.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const f = 'CML72620.pdf';
const tries = {
  plain: [`https://nsearchives.nseindia.com/content/circulars/${f}`, { 'user-agent': UA }],
  pdf_accept: [`https://nsearchives.nseindia.com/content/circulars/${f}`, { 'user-agent': UA, accept: 'application/pdf,*/*' }],
  referer: [`https://nsearchives.nseindia.com/content/circulars/${f}`, { 'user-agent': UA, accept: 'application/pdf,*/*', referer: base + '/resources/exchange-communication-circulars' }],
  archives_host: [`https://archives.nseindia.com/content/circulars/${f}`, { 'user-agent': UA, accept: 'application/pdf,*/*', referer: base + '/' }],
  www_host: [`${base}/content/circulars/${f}`, { 'user-agent': UA, accept: 'application/pdf,*/*', cookie, referer: base + '/resources/exchange-communication-circulars' }],
  www_api_path: [`${base}/api/circulars/${f}`, { 'user-agent': UA, accept: '*/*', cookie }],
};
const out = {};
for (const [k, [u, h]] of Object.entries(tries)) {
  try { const r = await fetch(u, { headers: h, redirect: 'follow' }); const b = Buffer.from(await r.arrayBuffer()); out[k] = { status: r.status, type: r.headers.get('content-type'), size: b.length, head: b.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.'), text: b.length < 25000 ? b.toString('latin1').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) : undefined }; }
  catch (e) { out[k] = { error: String(e).slice(0, 120) }; }
}
writeFileSync('data/source-test/etf-probe7.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
