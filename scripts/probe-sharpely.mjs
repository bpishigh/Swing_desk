// One-off probe (scope K5), round 2: the mutual-fund sitemap of sharpely.in and the raw markup around the portfolio snapshot and credit quality of one debt fund page. Writes data/funds/sharpely-probe.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'text/html,application/xml,*/*' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); return { status: r.status, t: await r.text() }; } catch { return { status: 0, t: '' }; } };
const out = { at: new Date().toISOString() };
const sm = await get('https://sharpely.in/sitemap-mf.xml'); const locs = [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
out.sitemap = { status: sm.status, n: locs.length, holdings: locs.filter((l) => /holdings/.test(l)).length, sample: locs.slice(0, 25), liquid: locs.filter((l) => /liquid/.test(l)).slice(0, 15), tails: [...new Set(locs.map((l) => l.split('/').pop()))].slice(0, 12) };
const pg = await get('https://sharpely.in/mutual-funds/axis-liquid-fund/15748/holdings'); const t = pg.t;
const around = (k, n) => { const i = t.indexOf(k); return i < 0 ? null : t.slice(Math.max(0, i - 200), i + n); };
out.page = { bytes: t.length, snapshot: around('Portfolio Snapshot', 1800), ytm: around('Yield to Maturity', 700), credit: around('Credit Quality', 3000), asOf: around('as on', 200) };
writeFileSync('data/funds/sharpely-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.sitemap.status, out.sitemap.n, out.sitemap.holdings);
