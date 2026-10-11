// Generates fixtures/expected/regime-v9.json by running the ORIGINAL v9 regime code (extracted from the v9 app file)
// over fixtures/db/tracker (India) and fixtures/db/us_tracker (US). Usage: node tools/make-v9-golden.mjs fixtures/app/swing-desk-v9.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(process.argv[2], 'utf8');
const grab = (startRe, endRe) => { const a = html.search(startRe); const rest = html.slice(a); const b = rest.search(endRe); return rest.slice(0, b); };
const code = [
  html.match(/const LVNAME = [^\n]+/)[0],
  html.match(/const num = [^\n]+/)[0],
  html.match(/const ok = [^\n]+/)[0],
  grab(/function chg\(r,p\)/, /function trackerRegime/),
].join('\n');
const ctx = { fmtDate: (d) => d, IDX: () => ({ a: 'A', b: 'B' }), US: () => false };
vm.createContext(ctx);
vm.runInContext(code + '\nthis.regimeFrom = regimeFrom; this.analyze = analyze;', ctx);
for (const [name, dir] of [['india','fixtures/db/tracker/'],['us','fixtures/db/us_tracker/']]) {
const rows = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ date: f.slice(0, -5), ...JSON.parse(readFileSync(dir + f, 'utf8')) })).sort((a, b) => a.date.localeCompare(b.date));
const out = [];
for (let i = 0; i < rows.length; i++) {
  const r = ctx.regimeFrom(rows.slice(0, i + 1));
  if (!r) continue;
  if (r.incomplete) { out.push({ date: rows[i].date, incomplete: true }); continue; }
  out.push({ date: rows[i].date, lv: r.lv, sma: r.sma, la: r.la, lb: r.lb, risingA: r.risingA, risingB: r.risingB, breadth: Number.isFinite(r.breadth) ? r.breadth : null,
    activeDist: r.A.active.length, expiredEarly: r.A.expiredEarly.length, ftdStatus: r.A.status, carriedFrom: null });
}
writeFileSync(`fixtures/expected/regime-v9-${name}.json`, JSON.stringify({ generatedBy: `v9 app regimeFrom over ${dir}`, rows: out }, null, 1));
console.log(name, out.length, 'rows;', out.filter((x) => !x.incomplete).length, 'complete');
}
