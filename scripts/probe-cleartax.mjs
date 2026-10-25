// One-off probe: structure of a ClearTax fund page (where manager, size, expense ratio sit). Writes data/funds/cleartax-probe.json. Public data only.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const slug = (n) => n.toLowerCase().replace(/direct plan/g, 'direct').replace(/growth option/g, 'growth').replace(/\(([^)]*)\)/g, '$1').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const funds = JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.filter((f) => f.g === 'intl').filter((f) => /Brazil|Axis Global Equity Alpha|Edelweiss ASEAN/.test(f.name));
const out = [];
for (const f of funds) {
  const url = `https://cleartax.in/mutual-funds/x/${slug(f.name)}/${f.isin}`; const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000), redirect: 'follow' }); const html = await r.text();
  const o = { name: f.name, status: r.status, final: r.url, bytes: html.length, scripts: [...html.matchAll(/<script([^>]*)>/g)].map((m) => m[1].slice(0, 90)).slice(0, 25), ld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 600)).slice(0, 3), ctx: {} };
  for (const k of ['Fund Manager', 'fund manager', 'Fund size', 'AUM', 'Expense ratio', 'Exit load', 'Benchmark', 'Turnover']) { const i = html.indexOf(k); if (i >= 0) o.ctx[k] = html.slice(Math.max(0, i - 120), i + 380).replace(/\s+/g, ' '); }
  const st = /window\.__[A-Z_]+__\s*=\s*/.exec(html); o.windowState = st ? st[0] + html.slice(st.index + st[0].length, st.index + st[0].length + 300) : null;
  out.push(o); await new Promise((r) => setTimeout(r, 400));
}
writeFileSync('data/funds/cleartax-probe.json', JSON.stringify({ at: new Date().toISOString(), funds: out }, null, 1) + '\n');
console.log(out.map((o) => o.status + ' ' + o.bytes).join('\n'));
