// One-off probe: which fund-quality facts (managers and start dates, AUM, benchmark, expense ratio, exit-load history, turnover, rating) does the public fund page carry in its embedded JSON?
// Writes data/funds/quality-probe.json: for six funds, every key path that looks relevant with a short sample value. Public data only.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
const sc = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds;
const want = ['Parag Parikh Flexi Cap', 'HDFC Mid Cap', 'UTI Nifty 50 Index', 'ICICI Prudential Technology', 'Motilal Oswal Nasdaq 100 Fund of Fund', 'HDFC Short Term Debt'];
const pick = want.map((k) => sc.find((f) => f.name.includes(k) && /Direct/i.test(f.name))).filter(Boolean);
const text = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); return { status: r.status, t: await r.text() }; };
const KEY = /manager|aum|fund_size|benchmark|expense|exit_?load|turnover|launch|rating|risk|since|date_from|date_to|tenure|stamp|min_|lock|holdings_count|fund_house|category/i;
const out = { at: new Date().toISOString(), funds: [] };
function walk(v, path, acc, depth = 0) {
  if (depth > 9 || v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) { if (v.length) { acc.push({ path: path + '[]', len: v.length, sample: JSON.stringify(v[0]).slice(0, 300) }); walk(v[0], path + '[]', acc, depth + 1); } return; }
  for (const [k, x] of Object.entries(v)) {
    const p = path ? path + '.' + k : k;
    if (KEY.test(k)) acc.push({ path: p, sample: typeof x === 'object' ? JSON.stringify(x).slice(0, 300) : String(x).slice(0, 120) });
    walk(x, p, acc, depth + 1);
  }
}
for (const f of pick) {
  const rec = { name: f.name, code: f.code, isin: f.isin };
  try {
    const s = await text(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${encodeURIComponent(f.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim())}&size=8`); let j = {}; try { j = JSON.parse(s.t); } catch {}
    const hit = (j.content ?? []).find((x) => String(x.scheme_code) === String(f.code) || x.isin === f.isin); rec.hit = hit ? hit.search_id : null;
    if (hit) { const p = await text(`https://groww.in/mutual-funds/${hit.search_id}`); rec.status = p.status; const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(p.t); if (m) { const acc = []; walk(JSON.parse(m[1]), '', acc); rec.paths = acc.slice(0, 160); } }
  } catch (e) { rec.error = String(e.message || e).slice(0, 200); }
  out.funds.push(rec);
}
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/quality-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.funds.map((r) => `${r.name}: hit=${r.hit} status=${r.status} paths=${r.paths?.length ?? 0}`).join('\n'));
