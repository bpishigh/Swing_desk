// One-off probe (Engine Rules C-78): which public sources return a fund's portfolio, and in what shape. Writes data/funds/holdings-probe.json. Public data only.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const FUNDS = [{ code: '122639', isin: 'INF879O01027', slug: 'parag-parikh-flexi-cap-fund-direct-growth' }, { code: '120716', isin: 'INF789F01XA0', slug: 'uti-nifty-50-index-fund-direct-growth' }, { code: '119063', isin: 'INF179K01WM1', slug: 'hdfc-index-fund-nifty-50-plan-direct-plan' }];
const shape = (v, d = 0) => (Array.isArray(v) ? `[${v.length}]${v.length && d < 3 ? shape(v[0], d + 1) : ''}` : v && typeof v === 'object' ? '{' + Object.keys(v).slice(0, 30).map((k) => k + (d < 2 ? ':' + shape(v[k], d + 1) : '')).join(',') + '}' : typeof v);
const urls = (f) => [
  ['groww-page', `https://groww.in/mutual-funds/${f.slug}`],
  ['groww-api', `https://groww.in/v1/api/data/mf/web/v1/scheme/${f.slug}`],
  ['kuvera', `https://api.kuvera.in/mf/api/v4/fund_schemes/${f.isin}.json`],
  ['captnemo', `https://mf.captnemo.in/kuvera/${f.isin}`],
  ['mfdata-holdings', `https://mfdata.in/api/v1/schemes/${f.code}/holdings`],
  ['mfdata-scheme', `https://mfdata.in/api/v1/schemes/${f.code}`],
  ['mfapi-meta', `https://api.mfapi.in/mf/${f.code}/latest`],
];
const out = { at: new Date().toISOString(), results: [] };
for (const f of FUNDS) for (const [name, url] of urls(f)) {
  const r = { fund: f.isin, name, url };
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000), redirect: 'follow' }); r.status = res.status; r.type = res.headers.get('content-type'); const t = await res.text(); r.bytes = t.length;
    if (res.ok) {
      let j = null; try { j = JSON.parse(t); } catch { const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(t); if (m) { try { j = JSON.parse(m[1]); r.nextData = true; } catch {} } }
      if (j) { r.shape = shape(j).slice(0, 1800); const s = JSON.stringify(j); const i = s.search(/holding|portfolio/i); r.holdingsAt = i; r.holdingsSample = i >= 0 ? s.slice(Math.max(0, i - 40), i + 700) : null; } else r.head = t.slice(0, 200);
    } else r.head = t.slice(0, 200);
  } catch (e) { r.error = String(e.message || e).slice(0, 200); }
  out.results.push(r);
}
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/holdings-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.results.map((r) => `${r.name} ${r.fund} ${r.status ?? r.error} ${r.bytes ?? ''} holdingsAt=${r.holdingsAt ?? '-'}`).join('\n'));
