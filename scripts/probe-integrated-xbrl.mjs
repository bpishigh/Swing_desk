// One-off probe, round 3b (package I-2): do the integrated-filing XBRL files carry revenue, profit and EPS facts, and with what tags and contexts? Writes data/probe-integrated-xbrl.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const get = async (url, h) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(60000) }); return { status: r.status, t: await r.text(), ct: r.headers.get('content-type') }; } catch (e) { return { status: 0, t: '' }; } };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
const out = { at: new Date().toISOString(), rows: [] };
for (const s of ['RELIANCE', 'TCS', 'KPITTECH', 'HDFCBANK', 'GALLANTT']) {
  const r = await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&symbol=${s}&page=1&size=50`, NSEH);
  const a = JSON.parse(r.t).data || [];
  for (const rec of [a[0], a[a.length - 1]].filter(Boolean)) {
    const x = await get(rec.xbrl, UA);
    const t = x.t; const names = [...new Set([...t.matchAll(/<([\w.-]+:[\w.-]+)[\s>\/]/g)].map((m) => m[1]))];
    const facts = [...t.matchAll(/<([\w.-]+:(\w*(?:Revenue|RevenueFromOperations|ProfitLoss|ProfitBeforeTax|TotalIncome|EarningsLossPerShare|EarningsPerShare|NetProfit)\w*))\s+([^>]*)>\s*([^<\s][^<]*?)\s*<\//g)].slice(0, 10).map((m) => ({ tag: m[1], attrs: m[3].replace(/\s+/g, ' ').slice(0, 90), v: m[4].slice(0, 20) }));
    out.rows.push({ s, qe: rec.qe_Date, consolidated: rec.consolidated, sub: rec.type_Sub, broadcast: rec.broadcast_Date, url: rec.xbrl, status: x.status, ct: x.ct, bytes: t.length, head: t.slice(0, 160).replace(/\s+/g, ' '), nElements: names.length, prefixes: [...new Set(names.map((n) => n.split(':')[0]))].slice(0, 8), facts });
    await new Promise((r2) => setTimeout(r2, 400));
  }
}
writeFileSync('data/probe-integrated-xbrl.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.rows.map((r) => `${r.s} ${r.qe} ${r.consolidated} st${r.status} el${r.nElements} facts${r.facts.length}`).join('\n'));
