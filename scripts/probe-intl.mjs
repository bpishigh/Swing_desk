// One-off probe: layout of a sharpely.in fund page for an international fund-of-funds. Writes data/funds/intl-probe.json.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const html = await (await fetch('https://sharpely.in/mutual-funds/motilal-oswal-nasdaq-100-fof-directgrowth/38228', { headers: UA })).text();
const out = { len: html.length, title: /<title>([^<]*)/.exec(html)?.[1], snips: {} };
for (const w of ['Expense Ratio', 'Expense ratio', 'AUM', 'Exit Load', 'Benchmark', 'Riskometer', 'invests? in units', 'Inception']) { const i = html.search(new RegExp(w)); out.snips[w] = i < 0 ? null : html.slice(Math.max(0, i - 150), i + 500); }
const sm = await (await fetch('https://sharpely.in/sitemap-mf.xml', { headers: UA })).text();
out.intlSlugs = [...sm.matchAll(/mutual-funds\/([^/<]*(?:nasdaq|global|us-|overseas|international|world|emerging|china|japan|europe|fof|s-p-500|s&p)[^/<]*)\/(\d+)</gi)].map((m) => m[1] + '/' + m[2]).slice(0, 80);
writeFileSync('data/funds/intl-probe.json', JSON.stringify(out, null, 1));
