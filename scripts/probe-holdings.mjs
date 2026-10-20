// One-off probe (Engine Rules C-78): which public sources return a fund's portfolio, and in what shape. Writes data/funds/holdings-probe.json. Public data only.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const FUNDS = [{ code: '122639', isin: 'INF879O01027', slug: '', q: 'parag parikh flexi cap direct growth' }, { code: '120716', isin: 'INF789F01XA0', slug: '', q: 'uti nifty 50 index fund direct growth' }, { code: '119063', isin: 'INF179K01WM1', slug: '', q: 'hdfc nifty 50 index fund direct growth' }];
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
const get = async (name, url, fund, deep) => {
  const r = { fund, name, url };
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000), redirect: 'follow' }); r.status = res.status; r.type = res.headers.get('content-type'); const t = await res.text(); r.bytes = t.length;
    let j = null; try { j = JSON.parse(t); } catch { const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(t); if (m) { try { j = JSON.parse(m[1]); r.nextData = true; } catch {} } }
    if (j) { r.shape = shape(j).slice(0, 2500); const s = JSON.stringify(j); const i = s.search(/"holdings?"|"portfolio_holdings|"top_holdings|"stock_name|"company_name/i); r.holdingsAt = i; r.holdingsSample = i >= 0 ? s.slice(Math.max(0, i - 40), i + 900) : null; r.json = deep ? j : undefined; } else r.head = t.slice(0, 200);
  } catch (e) { r.error = String(e.message || e).slice(0, 200); }
  out.results.push(r); return r;
};
for (const f of FUNDS) {
  const q = encodeURIComponent(f.q);
  const sr = await get('groww-search', `https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=5`, f.isin, true);
  const sid = sr.json?.content?.[0]?.search_id ?? sr.json?.content?.[0]?.id ?? null;
  if (sid) { await get('groww-scheme-page', `https://groww.in/mutual-funds/${sid}`, f.isin); await get('groww-scheme-api', `https://groww.in/v1/api/data/mf/web/v1/scheme/${sid}`, f.isin); }
  const cn = await get('captnemo', `https://mf.captnemo.in/kuvera/${f.isin}`, f.isin, true);
  const sc = cn.json?.[0]?.code ?? null;
  if (sc) for (const v of ['v3', 'v4', 'v5']) await get('kuvera-' + v, `https://api.kuvera.in/mf/api/${v}/fund_schemes/${sc}.json`, f.isin);
  await get('kuvera-isin', `https://api.kuvera.in/mf/api/v4/fund_schemes/${f.isin}.json`, f.isin);
}
for (const r of out.results) delete r.json;
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/holdings-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.results.map((r) => `${r.name} ${r.fund} ${r.status ?? r.error} ${r.bytes ?? ''} holdingsAt=${r.holdingsAt ?? '-'}`).join('\n'));
