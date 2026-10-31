// C-125: what the stop-width cap and the 3R room test remove. Reads saved replay trades (live exits) and compares, by group, mean R, median R, win rate and return per trade; the difference from the valid group gets a 90% month-cluster bootstrap interval. No rule or threshold is changed.
// Usage: node scripts/diagnose-setup-gates.mjs <label>=<trades.json> [...]
import { readFileSync, writeFileSync } from 'node:fs';
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
let seed = 20261031; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const K = 'live', f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2), p = (v) => (v * 100).toFixed(2) + '%';
const stat = (a) => ({ n: a.length, meanR: mean(a.map((x) => x.v[K].R)), medR: med(a.map((x) => x.v[K].R)), win: a.filter((x) => x.v[K].R > 0).length / (a.length || 1), ret: mean(a.map((x) => x.v[K].pct)), held: mean(a.map((x) => x.v[K].held)) });
function diffCI(A, B, key) {   // resample months (clusters) with replacement; mean(B) - mean(A)
  const months = [...new Set([...A, ...B].map((x) => x.ym))], by = (L) => { const m = {}; for (const x of L) (m[x.ym] ??= []).push(x.v[K][key]); return m; }, ma = by(A), mb = by(B), out = [];
  for (let r = 0; r < 4000; r++) { const sa = [], sb = []; for (let i = 0; i < months.length; i++) { const m = months[Math.floor(rnd() * months.length)]; if (ma[m]) sa.push(...ma[m]); if (mb[m]) sb.push(...mb[m]); } if (sa.length && sb.length) out.push(mean(sb) - mean(sa)); }
  out.sort((x, y) => x - y); return [out[Math.floor(out.length * 0.05)], out[Math.floor(out.length * 0.95)]];
}
const res = {}; let md = '# C-125: what the stop-width cap and the 3R room test remove\n\nLive exits. R = result in units of the trade\'s own risk. Difference = group minus valid, 90% month-cluster bootstrap interval.\n\n';
for (const arg of process.argv.slice(2)) {
  const [label, file] = arg.split('='), T = JSON.parse(readFileSync(file, 'utf8')); res[label] = {}; md += `## ${label}\n\n| Group | Trades | Mean R | Median R | Win rate | Return per trade | Mean R vs valid (90%) |\n|---|---|---|---|---|---|---|\n`;
  for (const id of ['all', '1', '2', '4']) {
    const sel = (c) => T.filter((x) => (id === 'all' || x.id === id) && x.cls === c), V = sel('valid');
    for (const [c, name] of [['valid', 'Valid'], ['tooWide', 'Stop too wide'], ['lowRoom', 'Room under 3R']]) {
      const G = sel(c); if (!G.length) continue; const s = stat(G), d = c === 'valid' ? null : diffCI(V, G, 'R');
      res[label][`${id}/${c}`] = { ...s, diffMeanR: d ? s.meanR - stat(V).meanR : null, diffCI: d };
      md += `| ${id === 'all' ? 'All setups' : 'Setup ' + id} ${name} | ${s.n} | ${f2(s.meanR)} | ${f2(s.medR)} | ${(s.win * 100).toFixed(0)}% | ${p(s.ret)} | ${d ? `${f2(s.meanR - stat(V).meanR)} (${f2(d[0])} to ${f2(d[1])})` : 'reference'} |\n`;
    }
  }
  md += '\n';
}
writeFileSync('data/replay/c125-gates.json', JSON.stringify({ run: new Date().toISOString().slice(0, 10), results: res }, null, 1) + '\n'); writeFileSync('docs/replay/C125-REPORT.md', md); console.log(md);
