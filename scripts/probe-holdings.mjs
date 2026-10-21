// One-off probe (Engine Rules C-78): can an ETF's portfolio be read from the same public source? Writes data/funds/holdings-probe.json. Public data only.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const sc = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => /ETF/i.test(f.name));
const pick = ['Nifty 50 ETF', 'Nifty BeES', 'Gold', 'Bank', 'Midcap'].map((k) => sc.find((f) => f.name.includes(k))).filter(Boolean).slice(0, 5);
const out = { at: new Date().toISOString(), results: [] };
const text = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); return { status: r.status, t: await r.text() }; };
for (const f of pick) {
  const rec = { name: f.name, code: f.code, isin: f.isin, tries: [] };
  try {
    const q = encodeURIComponent(f.name); const s = await text(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`); let j = {}; try { j = JSON.parse(s.t); } catch {}
    rec.search = (j.content ?? []).map((x) => ({ type: x.entity_type, sub: x.sub_entity_type, id: x.search_id, scheme_code: x.scheme_code, isin: x.isin, title: x.title, symbol: x.symbol }));
    const hit = (j.content ?? []).find((x) => String(x.scheme_code) === String(f.code) || x.isin === f.isin) ?? (j.content ?? [])[0];
    if (hit) for (const base of ['mutual-funds', 'etfs', 'stocks']) { const p = await text(`https://groww.in/${base}/${hit.search_id}`); const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(p.t); const tr = { base, status: p.status, bytes: p.t.length, nextData: !!m }; if (m) { const s2 = m[1]; const i = s2.search(/"holdings?"|"holding_/i); tr.holdingsAt = i; tr.sample = i >= 0 ? s2.slice(Math.max(0, i - 30), i + 500) : null; } rec.tries.push(tr); if (tr.holdingsAt > 0) break; }
  } catch (e) { rec.error = String(e.message || e).slice(0, 200); }
  out.results.push(rec);
}
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/holdings-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.results.map((r) => `${r.name}: ${r.tries.map((t) => `${t.base}=${t.status}/${t.holdingsAt}`).join(' ')}`).join('\n'));
