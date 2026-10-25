// One-off probe (scope K5): can debt-fund yield, maturity, duration and credit quality be read from sharpely.in pages, and can pages be found by fund? Reads robots.txt, the sitemap and one holdings page. Writes data/funds/sharpely-probe.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'text/html,application/xml,application/json,*/*' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000), redirect: 'follow' }); return { status: r.status, final: r.url, t: await r.text() }; } catch (e) { return { status: 0, t: '', err: String(e).slice(0, 100) }; } };
const out = { at: new Date().toISOString() };
const rb = await get('https://sharpely.in/robots.txt'); out.robots = { status: rb.status, text: rb.t.slice(0, 1500) };
const sm = await get('https://sharpely.in/sitemap.xml'); out.sitemap = { status: sm.status, bytes: sm.t.length, head: sm.t.slice(0, 600), locs: [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 30) };
const pg = await get('https://sharpely.in/mutual-funds/axis-liquid-fund/15748/holdings');
const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(pg.t);
out.page = { status: pg.status, bytes: pg.t.length, hasNext: !!nd, ytm: (/Yield to Maturity[\s\S]{0,200}/.exec(pg.t) ?? [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200), scripts: [...pg.t.matchAll(/<script([^>]*)>/g)].map((m) => m[1].slice(0, 80)).slice(0, 12) };
if (nd) { try { const j = JSON.parse(nd[1]); out.page.keys = Object.keys(j.props?.pageProps ?? {}).slice(0, 30); out.page.sample = JSON.stringify(j.props?.pageProps).slice(0, 1500); } catch {} }
for (const q of ['https://sharpely.in/api/search?q=axis%20liquid', 'https://sharpely.in/mutual-funds/axis-liquid-fund']) { const r = await get(q); (out.tries ??= []).push({ q, status: r.status, final: r.final, bytes: r.t.length, head: r.t.slice(0, 300) }); }
writeFileSync('data/funds/sharpely-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.robots.status, out.sitemap.status, out.page.status, out.page.hasNext);
