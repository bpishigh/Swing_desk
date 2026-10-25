// One-off probe: why do most Indian international fund-of-funds not match a fund page (quality capture)? Writes data/funds/intl-match-probe.json. Public data only.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseQuality } from '../src/pm/holdingsparse.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const funds = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'intl').slice(0, 14);
const out = [];
for (const f of funds) {
  const o = { code: f.code, isin: f.isin, name: f.name };
  const q = encodeURIComponent(f.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim());
  try {
    const r = await fetch(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`, { headers: UA, signal: AbortSignal.timeout(30000) }); o.searchStatus = r.status; const j = r.ok ? await r.json() : null;
    o.results = (j?.content ?? []).map((x) => ({ n: x.scheme_name ?? x.title, code: x.scheme_code, isin: x.isin, id: x.search_id, entity: x.entity_type }));
    const hit = (j?.content ?? []).find((x) => String(x.scheme_code) === String(f.code) || (x.isin && x.isin === f.isin)); o.hit = hit?.search_id ?? null;
    // second try: the plain fund name without "Fund of Fund"/"Overseas" words, and the ISIN itself
    for (const alt of [f.isin, f.name.split(' - ')[0]]) { if (o.hit) break; const r2 = await fetch(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${encodeURIComponent(alt)}&size=8`, { headers: UA, signal: AbortSignal.timeout(30000) }); const j2 = r2.ok ? await r2.json() : null; const h2 = (j2?.content ?? []).find((x) => String(x.scheme_code) === String(f.code) || (x.isin && x.isin === f.isin)); (o.alt ??= []).push({ q: alt, status: r2.status, n: j2?.content?.length ?? 0, hit: h2?.search_id ?? null }); if (h2) o.hit = h2.search_id; }
    if (o.hit) { const p = await fetch(`https://groww.in/mutual-funds/${o.hit}`, { headers: UA, signal: AbortSignal.timeout(40000) }); o.pageStatus = p.status; const html = p.ok ? await p.text() : ''; const ql = parseQuality(html); o.quality = ql ? { managers: ql.managers.length, aum: ql.aum, expense: ql.expense } : null; const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); try { const d = JSON.parse(m[1]).props.pageProps.mfServerSideData; o.fields = { fund_manager: d?.fund_manager ?? null, details: Array.isArray(d?.fund_manager_details) ? d.fund_manager_details.length : null }; } catch { o.fields = null; } }
  } catch (e) { o.error = String(e.message || e).slice(0, 100); }
  out.push(o); await new Promise((r) => setTimeout(r, 300));
}
writeFileSync('data/funds/intl-match-probe.json', JSON.stringify({ at: new Date().toISOString(), funds: out }, null, 1) + '\n');
console.log(out.map((o) => `${o.code} hit=${o.hit} q=${JSON.stringify(o.quality)}`).join('\n'));
