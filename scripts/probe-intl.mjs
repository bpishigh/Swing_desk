// One-off probe: does a sharpely.in fund page say which countries an international fund holds? Writes data/ops/intl-probe.json.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); return r.ok ? await r.text() : 'HTTP ' + r.status; } catch (e) { return 'ERR ' + e.message; } };
const sm = await get('https://sharpely.in/sitemap-mf.xml');
const urls = [...sm.matchAll(/<loc>(https:\/\/sharpely\.in\/mutual-funds\/[^<]+)<\/loc>/g)].map((m) => m[1]);
const want = [/edelweiss-us-technology/, /edelweiss-emerging-markets/, /edelweiss-europe/, /motilal-oswal-nasdaq-100-fund-of/, /icici-prudential-nasdaq/, /invesco-india-invesco-global-consumer/, /mirae-asset-nyse-fang/, /dsp-world-gold/];
const out = {};
for (const w of want) { const u = urls.find((x) => w.test(x) && /direct/.test(x)); if (!u) { out[w.source] = null; continue; }
  const h = await get(u);
  const keys = [...new Set([...h.matchAll(/\\?"([A-Za-z_]*(?:countr|geograph|region|currenc|underlying|overseas|feeder|domicile)[A-Za-z_]*)\\?"\s*:\s*(\\?"[^"\\]{0,80}|[\d.\[{]{1,60})/gi)].map((m) => m[1] + '=' + m[2]))].slice(0, 25);
  const txt = [...h.matchAll(/.{0,100}(?:United States|U\.S\.|Taiwan|China|Europe|Country allocation|country|geograph).{0,140}/g)].slice(0, 6).map((m) => m[0]);
  out[w.source] = { url: u, len: h.length, keys, txt }; }
writeFileSync('data/ops/intl-probe.json', JSON.stringify(out, null, 1) + '\n');
