// One-off: can the runner fetch a Dhan stock page and read its published moving averages and date stamp?
// The page address comes from the DHAN_URL env var (a workflow input), never from the repo. Output holds page text snippets only.
import { mkdirSync, writeFileSync } from 'node:fs';
const url = process.env.DHAN_URL;
if (!url || !/^https:\/\/dhan\.co\//.test(url)) { console.error('DHAN_URL missing or not a dhan.co address'); process.exit(1); }
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*', 'accept-language': 'en-US,en;q=0.9' };
const variants = [url.replace(/-technical-analysis\/?$/, '-share-price/'), url.replace(/-share-price\/?$/, '-technical-analysis/')];
const out = { ts: new Date().toISOString(), pages: [] };
for (const u of [...new Set(variants)]) {
  const p = { kind: /share-price/.test(u) ? 'share-price' : 'technical-analysis', status: null, bytes: 0, snippets: [] };
  try {
    const r = await fetch(u, { headers: H, redirect: 'follow' });
    p.status = r.status; const html = await r.text(); p.bytes = html.length;
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    p.textLen = text.length;
    for (const re of [/\b(50|200)\s*(DMA|SMA|Day)/gi, /\bEMA\b/gi, /\bas on\b/gi, /last updated|updated on/gi]) {
      let m, n = 0;
      while ((m = re.exec(text)) && n < 6) { p.snippets.push(text.slice(Math.max(0, m.index - 40), m.index + 140)); n++; }
    }
    const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
    p.nextData = nd ? { bytes: nd[1].length, hasDMA: /DMA|dma/.test(nd[1]), hasSma: /sma/i.test(nd[1]) } : null;
  } catch (e) { p.error = String(e); }
  out.pages.push(p);
}
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/dhan-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.pages.map((p) => [p.kind, p.status, p.bytes, p.snippets.length, p.error])));
