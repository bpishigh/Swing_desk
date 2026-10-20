// One-off: list every NSE "Face Value Split" circular for ETFs (Feb-Oct 2026) and read the notice text (ratio, record/effective date, symbols).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const pdfParse = createRequire('/tmp/pdfdeps/')('pdf-parse/lib/pdf-parse.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const base = 'https://www.nseindia.com';
const w = await fetch(base, { headers: H }); let cookie = (w.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const w2 = await fetch(base + '/resources/exchange-communication-circulars', { headers: { ...H, cookie } }); cookie += '; ' + (w2.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const HA = { ...H, cookie, referer: base + '/resources/exchange-communication-circulars', accept: 'application/json, text/plain, */*' };
const wins = [['01-02-2026', '28-02-2026'], ['01-03-2026', '31-03-2026'], ['01-04-2026', '30-04-2026'], ['01-05-2026', '31-05-2026'], ['01-06-2026', '30-06-2026'], ['01-07-2026', '31-07-2026'], ['01-08-2026', '31-08-2026'], ['01-09-2026', '30-09-2026'], ['01-10-2026', '10-10-2026']];
const seen = new Map(); const counts = [];
for (const [f, t] of wins) {
  const r = await fetch(`${base}/api/circulars?fromDate=${f}&toDate=${t}`, { headers: HA }); const j = await r.json().catch(() => null); const a = Array.isArray(j) ? j : j?.data ?? [];
  counts.push([f, r.status, a.length]); for (const c of a) seen.set(c.circDisplayNo, c);
}
const splits = [...seen.values()].filter((c) => (/face value split|unit split|sub-?division|consolidation of units/i.test(c.sub) && /ETF|Fund|Asset Management|Mutual/i.test(c.sub)) || /^NSE\/CML\/72617$/.test(c.circDisplayNo));
mkdirSync('/tmp/etfc', { recursive: true });
const groww = [...seen.values()].filter((c) => /groww/i.test(c.sub)).map((c) => ({ date: c.cirDate, no: c.circDisplayNo, sub: c.sub }));
const out = [];
for (const c of splits.sort((a, b) => a.cirDate.localeCompare(b.cirDate))) {
  const rec = { date: c.cirDate, no: c.circDisplayNo, sub: c.sub, link: c.circFilelink, text: null };
  try {
    const r = await fetch(c.circFilelink.replace('nsearchives.', 'archives.'), { headers: H }); const buf = Buffer.from(await r.arrayBuffer());
    let file = `/tmp/etfc/${c.circNumber}.${c.fileExt}`; writeFileSync(file, buf);
    if (c.fileExt === 'zip') { execFileSync('unzip', ['-o', '-q', file, '-d', `/tmp/etfc/${c.circNumber}`]); file = execFileSync('sh', ['-c', `ls /tmp/etfc/${c.circNumber}/* | head -1`]).toString().trim(); }
    rec.text = /\.pdf$/i.test(file) ? (await pdfParse(readFileSync(file))).text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').slice(0, 4000) : readFileSync(file, 'utf8').slice(0, 1500);
  } catch (e) { rec.error = String(e).slice(0, 150); try { const f2 = `/tmp/etfc/${c.circNumber}.${c.fileExt}`; const b = readFileSync(f2); rec.debug = { ext: c.fileExt, size: b.length, head: b.subarray(0, 12).toString('hex'), ascii: b.subarray(0, 60).toString('latin1').replace(/[^\x20-\x7e]/g, '.') }; } catch {} }
  out.push(rec);
}
writeFileSync('data/source-test/etf-probe6.json', JSON.stringify({ ts: new Date().toISOString(), counts, total: seen.size, groww, found: out.length, items: out }, null, 1) + '\n');
console.log(JSON.stringify(counts), seen.size, out.length, out.filter((o) => o.text).length);
