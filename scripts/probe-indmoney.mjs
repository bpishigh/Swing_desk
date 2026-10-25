// One-off probe: do INDmoney fund pages carry managers, size, expense ratio, benchmark, turnover and exit load for the funds the Groww page lacks? Public data only. Writes data/funds/indmoney-probe-' + (process.env.SRC || 'indmoney') + '.json.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const funds = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'intl').slice(0, 14);
const AMC = (n) => { const w = n.toLowerCase(); return /^aditya birla/.test(w) ? 'aditya-birla-sun-life-mutual-fund' : /^(hsbc|kotak|axis|dsp|sbi|icici|edelweiss|bandhan|franklin|invesco|sundaram|mirae|motilal|baroda)/.test(w) ? w.split(' ')[0] + '-mutual-fund' : null; };
const slug = (n) => n.toLowerCase().replace(/direct plan/g, 'direct').replace(/growth option/g, 'growth').replace(/\(([^)]*)\)/g, '$1').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const RE = /manager|aum|fund_size|expense|benchmark|turnover|exit|launch|since|tenure/i;
const walk = (v, p, out, d = 0) => { if (d > 9 || v == null) return; if (Array.isArray(v)) { if (v.length) walk(v[0], p + '[]', out, d + 1); return; } if (typeof v === 'object') { for (const [k, x] of Object.entries(v)) walk(x, p ? p + '.' + k : k, out, d + 1); return; } if (RE.test(p)) out.push({ path: p, sample: String(v).slice(0, 80) }); };
const SRC = (o, f) => process.env.SRC === 'cleartax' ? `https://cleartax.in/mutual-funds/${AMC(f.name) ?? 'x'}/${slug(f.name)}/${f.isin}` : process.env.SRC === '5paisa' ? `https://www.5paisa.com/mutual-funds/${slug(f.name)}` : 'https://www.indmoney.com/mutual-funds/' + o.slug;
const res = []; let hits = 0;
for (const f of funds) {
  const o = { code: f.code, name: f.name, slug: slug(f.name) };
  try { const r = await fetch(o.url = SRC(o, f), { headers: UA, signal: AbortSignal.timeout(40000), redirect: 'follow' }); o.status = r.status; o.final = r.url; const html = r.ok ? await r.text() : '';
    const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); o.nextData = !!m;
    if (m) { try { const out = []; walk(JSON.parse(m[1]), '', out); o.paths = res.length < 3 ? out.slice(0, 80) : out.slice(0, 12).map((x) => x.path); } catch { o.paths = 'bad json'; } }
    if (r.ok) hits++;
  } catch (e) { o.error = String(e.message || e).slice(0, 80); }
  res.push(o); await new Promise((r) => setTimeout(r, 400));
}
writeFileSync('data/funds/indmoney-probe-' + (process.env.SRC || 'indmoney') + '.json', JSON.stringify({ at: new Date().toISOString(), tried: funds.length, ok: hits, funds: res }, null, 1) + '\n');
console.log('tried', funds.length, 'ok', hits);
