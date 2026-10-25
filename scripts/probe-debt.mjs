// One-off probe (scope K5): what a Groww debt-fund page carries on credit quality, maturity, duration and yield. Writes data/funds/debt-probe.json. Public data only.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000) }); return r.ok ? await r.text() : null; } catch { return null; } };
const funds = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'debt');
const cats = [...new Set(funds.map((f) => f.cat))]; const pick = []; for (const c of ['Liquid', 'Corporate', 'Gilt', 'Credit', 'Short', 'Banking']) { const f = funds.find((x) => x.cat && x.cat.includes(c.split(' ')[0]) && x.isin); if (f) pick.push(f); }
const out = { at: new Date().toISOString(), cats, funds: [] };
const walk = (o, path, hits, d = 0) => { if (!o || typeof o !== 'object' || d > 8) return; for (const [k, v] of Object.entries(o)) { const p = path + '.' + k; if (/ytm|yield|maturity|duration|rating|credit|sov|aaa|sector_?alloc|asset_?alloc|holdings?$/i.test(k)) hits.push({ p, v: JSON.stringify(v).slice(0, 260) }); walk(v, p, hits, d + 1); } };
for (const f of pick) {
  const q = encodeURIComponent(f.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim());
  const s = await get(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`); let hit = null; try { hit = JSON.parse(s ?? '{}').content?.find((x) => String(x.scheme_code) === String(f.code)); } catch {}
  const row = { name: f.name, cat: f.cat, hit: !!hit };
  if (hit) { const html = await get(`https://groww.in/mutual-funds/${hit.search_id}`); const m = html && /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (m) { const d = JSON.parse(m[1]).props?.pageProps?.mfServerSideData ?? {}; row.keys = Object.keys(d); row.hits = []; walk(d, 'mf', row.hits); row.hits = row.hits.slice(0, 40); } }
  out.funds.push(row); await new Promise((r) => setTimeout(r, 1000));
}
writeFileSync('data/funds/debt-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.funds.map((r) => `${r.name} hit=${r.hit} hits=${r.hits?.length}`).join('\n'));
