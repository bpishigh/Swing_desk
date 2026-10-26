// One-off probe: what exit-load wording do sharpely.in pages give for non-international funds? Writes data/ops/exit-probe.json.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); return r.ok ? await r.text() : 'HTTP ' + r.status; } catch (e) { return 'ERR ' + e.message; } };
const sm = await get('https://sharpely.in/sitemap-mf.xml');
const urls = [...sm.matchAll(/<loc>(https:\/\/sharpely\.in\/mutual-funds\/([^/<]+)\/\d+)<\/loc>/g)].map((m) => m[1]);
const want = [/uti-master|uti-large-cap/, /axis-liquid/, /parag-parikh-flexi/, /axis-small-cap/, /nippon-india-multi-asset/, /icici-prudential-technology/, /motilal-oswal-midcap/, /hdfc-liquid/];
const out = { sitemapUrls: urls.length, samples: {} };
for (const w of want) { const u = urls.find((x) => w.test(x) && /direct/.test(x)) ?? urls.find((x) => w.test(x)); if (!u) { out.samples[w.source] = null; continue; }
  const h = await get(u); const ctx = [...h.matchAll(/.{0,160}[Ee]xit[ _]?[Ll]oad.{0,260}/g)].slice(0, 6).map((m) => m[0]); const fee = /feesAndCommissionsSpecification\\?":\\?"([^"\\]*)/.exec(h)?.[1] ?? null;
  out.samples[w.source] = { url: u, len: h.length, fee, ctx }; }
writeFileSync('data/ops/exit-probe.json', JSON.stringify(out, null, 1) + '\n');
