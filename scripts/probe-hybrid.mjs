// One-off probe: does a sharpely.in fund page carry the asset mix (equity, debt, cash) of a hybrid fund? Writes data/ops/hybrid-probe.json.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); return r.ok ? await r.text() : 'HTTP ' + r.status; } catch (e) { return 'ERR ' + e.message; } };
const sm = await get('https://sharpely.in/sitemap-mf.xml');
const urls = [...sm.matchAll(/<loc>(https:\/\/sharpely\.in\/mutual-funds\/[^<]+)<\/loc>/g)].map((m) => m[1]);
const want = [/hdfc-balanced-advantage/, /icici-prudential-equity-and-debt/, /sbi-equity-hybrid/, /icici-prudential-multi-asset/, /kotak-equity-savings/, /hdfc-hybrid-debt/, /kotak-arbitrage/];
const out = {};
for (const w of want) { const u = urls.find((x) => w.test(x) && /direct/.test(x)); if (!u) { out[w.source] = null; continue; }
  const h = await get(u);
  const keys = [...new Set([...h.matchAll(/\\?"([A-Za-z_]*(?:alloc|equity|debt|cash|asset|composition|mix|holding)[A-Za-z_]*)\\?"\s*:\s*(\\?"[^"\\]{0,60}|[\d.\[{]{1,80})/gi)].map((m) => m[1] + '=' + m[2]))].slice(0, 60);
  const txt = [...h.matchAll(/.{0,120}(?:Asset Allocation|asset allocation|Equity Holding|equity_holding|Debt Holding).{0,200}/g)].slice(0, 5).map((m) => m[0]);
  out[w.source] = { url: u, len: h.length, keys, txt }; }
writeFileSync('data/ops/hybrid-probe.json', JSON.stringify(out, null, 1) + '\n');
