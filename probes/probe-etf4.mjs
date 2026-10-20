// One-off: scan NSE circulars (Feb-Oct 2026) for ETF unit split / consolidation notices.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const base = 'https://www.nseindia.com';
const w = await fetch(base, { headers: H }); let cookie = (w.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const w2 = await fetch(base + '/resources/exchange-communication-circulars', { headers: { ...H, cookie } }); cookie += '; ' + (w2.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const HA = { ...H, cookie, referer: base + '/resources/exchange-communication-circulars', accept: 'application/json, text/plain, */*' };
const all = new Map(); const log = [];
for (const [from, to] of [['01-02-2026', '31-03-2026'], ['01-04-2026', '31-05-2026'], ['01-06-2026', '31-07-2026'], ['01-08-2026', '31-10-2026']]) {
  for (const q of ['', '&subject=ETF', '&subject=split', '&subject=unit']) {
    const r = await fetch(`${base}/api/circulars?from_date=${from}&to_date=${to}&dept=&subject=${q.replace(/^&subject=/, '')}`, { headers: HA });
    const t = await r.text(); let a = []; try { const j = JSON.parse(t); a = Array.isArray(j) ? j : j.data ?? []; } catch {}
    log.push([from, q || 'all', r.status, a.length]); for (const c of a) all.set(c.circDisplayNo + '|' + c.sub, c);
  }
}
const rows = [...all.values()];
const hit = rows.filter((c) => /split|sub-?division|consolidat|face value|unit|ETF|exchange traded/i.test(c.sub));
writeFileSync('data/source-test/etf-probe4.json', JSON.stringify({ ts: new Date().toISOString(), log, total: rows.length, hits: hit.map((c) => ({ date: c.cirDate, dept: c.circDepartment, no: c.circDisplayNo, sub: c.sub, link: c.circFilelink })) }, null, 1) + '\n');
console.log(JSON.stringify(log), rows.length, hit.length);
