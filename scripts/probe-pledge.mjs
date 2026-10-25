// One-off probe (scope K3): where promoter pledge can be read from. NSE's pledged-data endpoint (needs a cookie from the home page), Screener's ratio list, BSE's shareholding API. Public data only. Writes data/probe-pledge.json.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'accept-language': 'en-IN,en;q=0.9' };
const syms = ['RELIANCE', 'ADANIENT', 'RPOWER', 'JPPOWER', 'TCS'];
const out = { at: new Date().toISOString(), nse: [], screener: [], bse: [] };
const get = async (url, h = {}) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(40000), redirect: 'follow' }); const t = await r.text(); return { status: r.status, t, cookie: r.headers.getSetCookie?.() ?? [] }; } catch (e) { return { status: 0, err: String(e).slice(0, 120), t: '', cookie: [] }; } };
// NSE: home page for cookies, then the JSON endpoints
const home = await get('https://www.nseindia.com/'); const ck = home.cookie.map((c) => c.split(';')[0]).join('; ');
out.nseHome = { status: home.status, cookies: home.cookie.length };
for (const s of syms) for (const ep of [`corporate-pledgedata?index=equities&symbol=${s}`, `corporate-share-holdings-master?index=equities&symbol=${s}`]) {
  const r = await get('https://www.nseindia.com/api/' + ep, { cookie: ck, referer: 'https://www.nseindia.com/', accept: 'application/json' });
  out.nse.push({ s, ep: ep.split('?')[0], status: r.status, bytes: r.t.length, head: r.t.slice(0, 700) }); await new Promise((r) => setTimeout(r, 1200));
}
for (const s of syms) { const r = await get(`https://www.screener.in/company/${s}/consolidated/`); const i = r.t.indexOf('Pledged'); out.screener.push({ s, status: r.status, ctx: i >= 0 ? r.t.slice(Math.max(0, i - 200), i + 250).replace(/\s+/g, ' ') : null }); await new Promise((r) => setTimeout(r, 1500)); }
for (const u of ['https://api.bseindia.com/BseIndiaAPI/api/ShareholdingPromoters/w?scripcode=512599&qtrid=', 'https://api.bseindia.com/BseIndiaAPI/api/SHPannexure/w?scripcode=512599']) { const r = await get(u, { referer: 'https://www.bseindia.com/', origin: 'https://www.bseindia.com' }); out.bse.push({ u, status: r.status, bytes: r.t.length, head: r.t.slice(0, 400) }); }
writeFileSync('data/probe-pledge.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.nse.map((o) => `${o.s} ${o.ep} ${o.status} ${o.bytes}`).join('\n'), '\n', out.screener.map((o) => `${o.s} ${o.status} ${!!o.ctx}`).join('\n'));
