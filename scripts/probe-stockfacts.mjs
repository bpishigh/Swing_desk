// One-off probe (scope K3): which public pages carry business facts for a listed stock (valuation, growth, debt, promoter holding and pledge), and how reliably they can be read. Writes data/probe-stockfacts.json. Public data only, a handful of large and small names.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'accept-language': 'en-IN,en;q=0.9' };
const names = { RELIANCE: 'reliance-industries-ltd', TCS: 'tata-consultancy-services-ltd', KPITTECH: 'kpit-technologies-ltd', SUZLON: 'suzlon-energy-ltd' };
const out = [];
const get = async (url) => { try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000), redirect: 'follow' }); const t = await r.text(); return { status: r.status, final: r.url, t }; } catch (e) { return { status: 0, err: String(e).slice(0, 120), t: '' }; } };
for (const [sym, slug] of Object.entries(names)) {
  const g = await get(`https://groww.in/stocks/${slug}`);
  const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(g.t);
  let keys = null, fund = null;
  if (nd) { try { const j = JSON.parse(nd[1]); const pp = j.props?.pageProps ?? {}; keys = Object.keys(pp).slice(0, 30); const find = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 6) return; for (const [k, v] of Object.entries(o)) { if (/shareholding|promoter|pledge|peRatio|pbRatio|roe|debtToEquity|eps|stats|fundamental|financial/i.test(k) && v !== null) (fund ??= {})[k] = JSON.stringify(v).slice(0, 220); find(v, d + 1); } }; find(pp); } catch (e) { keys = 'parse error ' + e.message; } }
  const s = await get(`https://www.screener.in/company/${sym}/consolidated/`);
  const sc = { status: s.status, bytes: s.t.length, hasRatios: /Stock P\/E/.test(s.t), hasPromoter: /Promoters/.test(s.t), hasPledge: /Pledged/.test(s.t), hasROCE: /ROCE/.test(s.t) };
  out.push({ sym, groww: { status: g.status, bytes: g.t.length, hasNext: !!nd, keys, fund: fund && Object.fromEntries(Object.entries(fund).slice(0, 25)) }, screener: sc });
  await new Promise((r) => setTimeout(r, 1500));
}
writeFileSync('data/probe-stockfacts.json', JSON.stringify({ at: new Date().toISOString(), out }, null, 1) + '\n');
console.log(out.map((o) => `${o.sym} groww ${o.groww.status} next=${o.groww.hasNext} | screener ${o.screener.status} ratios=${o.screener.hasRatios}`).join('\n'));
