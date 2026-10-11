// Runs the ORIGINAL v9 ntCalc + ntChecks on a seeded grid and writes fixtures/expected/checklist-v9.json.
// Usage: node tools/make-v9-checklist-golden.mjs fixtures/app/swing-desk-v9.html
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(process.argv[2], 'utf8');
const line = (re) => html.match(re)[0];
const grab = (startRe, endRe) => { const a = html.search(startRe); const rest = html.slice(a); return rest.slice(0, rest.search(endRe)); };
const code = [
  line(/const num = [^\n]+/), line(/const ok = [^\n]+/), line(/const esc = [^\n]+/),
  line(/const inrFix = [^\n]+/), line(/const usd = [^\n]+/), line(/const inr = [^\n]+/), line(/const parseD = [^\n]+/),
  grab(/function weekdaysBetween/, /\nconst daysBetween/),
  grab(/const SETUPS = \{/, /\nconst LV = /),
  grab(/function ntCalc\(\)/, /\nfunction renderNewTrade/),
].join('\n');
const st = {};
const ctx = {
  MKT: 'india', TODAY: '2026-10-05',
  US: () => ctx.MKT === 'us',
  DR: () => ({ nt: st.d }), currentLimits: () => st.L, capital: () => st.cap, sectorStatus: () => st.ss,
  countBySector: () => st.counts, openRiskRs: () => st.orisk,
  openTrades: () => Array.from({ length: st.nOpen }, (_, k) => ({ entryDate: k < st.openToday ? '2026-10-05' : '2026-09-01' })),
  closedTrades: () => Array.from({ length: st.closedToday }, () => ({ entryDate: '2026-10-05' })),
  plannedTrades: () => Array.from({ length: st.plannedToday }, () => ({ createdDate: '2026-10-05' })),
};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.ntCalc = ntCalc; this.ntChecks = ntChecks;', ctx);
let seed = 987654; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const LIM = {
  india: { green: { setups: ['1', '1ipo', '2', '3', '4'], maxPos: 10, cap: 5 }, yellow: { setups: ['1', '1ipo', '3', '4'], maxPos: 5, cap: 2.5 }, red: { setups: ['1', '1ipo', '2', '3', '4'], maxPos: 2, cap: 0.5 } },
  us: { green: { setups: ['1', '1ipo', '2', '4'], maxPos: 4, cap: 2 }, yellow: { setups: ['1', '1ipo', '4'], maxPos: 4, cap: 2 }, red: { setups: ['1', '1ipo', '2', '4'], maxPos: 2, cap: 0.5 } },
};
const cases = [];
for (let n = 0; n < 500; n++) {
  const market = pick(['india', 'us']); ctx.MKT = market;
  const setup = pick(['1', '1ipo', '2', '3', '4']);
  const light = pick(['green', 'yellow', 'red', null]);
  const basis = +(20 + rnd() * 2000).toFixed(2);
  const chartStop = +(basis * (0.85 + rnd() * 0.14)).toFixed(2);
  const atr = rnd() < 0.8 ? +(basis * (0.005 + rnd() * 0.06)).toFixed(2) : undefined;
  const close = rnd() < 0.7 ? +(basis * (0.95 + rnd() * 0.05)).toFixed(2) : undefined;
  const resistance = rnd() < 0.7 ? +(basis * (1.02 + rnd() * 0.3)).toFixed(2) : undefined;
  const capital = pick([300000, 980000, 2500000]);
  const riskBase = pick([0.25, 0.5, 1]);
  const sectorName = pick(['', 'Nifty IT', 'Nifty Bank']);
  const sector = sectorName ? pick([null, { rank: 1, persist: true, newLeader: false, above200: true }, { rank: 3, persist: false, newLeader: true, above200: true }, { rank: 6, persist: false, newLeader: false, above200: false }, { rank: null, persist: false, newLeader: false, above200: null }]) : null;
  const industry = pick(['', 'Pharma', 'Metals']);
  const tri = () => pick(['yes', 'no', '']);
  const bottomUp = tri(), rs = tri(), above50 = tri(), chartLevel = tri(), band = tri(), lowerCircuit = tri();
  const listed = rnd() < 0.5 ? Math.floor(rnd() * 60) : undefined;
  const resultsInWeekdays = rnd() < 0.7 ? Math.floor(rnd() * 25) : null;
  const results = resultsInWeekdays === null ? '' : (() => { const d = new Date(2026, 9, 5); let k = resultsInWeekdays; if (k === 0) return '2026-10-05'; while (k > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k--; } return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const nOpen = Math.floor(rnd() * 12), openToday = Math.min(nOpen, Math.floor(rnd() * 3)), closedToday = Math.floor(rnd() * 2), plannedToday = Math.floor(rnd() * 2);
  const orisk = Math.round(rnd() * capital * 0.06);
  const sectorCount = Math.floor(rnd() * 5), industryCount = Math.floor(rnd() * 4);
  st.d = { setup, basis: String(basis), stop: String(chartStop), atr: atr === undefined ? '' : String(atr), close: close === undefined ? '' : String(close), resistance: resistance === undefined ? '' : String(resistance), sector: sectorName, industry, bottomUp, rs, above50, chartLevel, band, lowerCircuit, listed: listed === undefined ? '' : String(listed), results };
  st.L = light ? { name: light, risk: riskBase, ...LIM[market][light] } : null;
  st.cap = capital; st.ss = sector; st.orisk = orisk; st.nOpen = nOpen; st.openToday = openToday; st.closedToday = closedToday; st.plannedToday = plannedToday;
  st.counts = { sec: { [sectorName]: sectorCount }, ind: { [industry.toLowerCase()]: industryCount } };
  const o = ctx.ntCalc();
  if (o.noCap || o.trigger === undefined) continue;
  const items = ctx.ntChecks(o).map((x) => ({ s: x.s, t: x.t }));
  cases.push({ market, input: { setup, basis, chartStop, atr, close, resistance, capital, light, riskBase, sector, bottomUp: bottomUp === 'yes', sectorName, industry, tri: { bottomUp, rs, above50, chartLevel, band, lowerCircuit }, listed, resultsInWeekdays, openCount: nOpen, openRiskRs: orisk, entriesToday: openToday + closedToday + plannedToday, sectorCount, industryCount }, expected: items });
}
writeFileSync('fixtures/expected/checklist-v9.json', JSON.stringify({ generatedBy: 'v9 ntCalc + ntChecks, seeded grid', cases }));
console.log(cases.length, 'cases');
