// Runs the ORIGINAL v9 ntCalc on a seeded grid of inputs and writes fixtures/expected/ntcalc-v9.json.
// Usage: node tools/make-v9-ntcalc-golden.mjs fixtures/app/swing-desk-v9.html
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(process.argv[2], 'utf8');
const grab = (startRe, endRe) => { const a = html.search(startRe); const rest = html.slice(a); return rest.slice(0, rest.search(endRe)); };
const code = [html.match(/const num = [^\n]+/)[0], html.match(/const ok = [^\n]+/)[0], grab(/const SETUPS = \{/, /\nconst LV = /), grab(/function ntCalc\(\)/, /\nfunction ntChecks/)].join('\n');
const state = { nt: {}, L: null, ss: null, cap: 0 };
const ctx = { DR: () => ({ nt: state.nt }), currentLimits: () => state.L, capital: () => state.cap, sectorStatus: () => state.ss };
vm.createContext(ctx);
vm.runInContext(code + '\nthis.ntCalc = ntCalc;', ctx);
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const cases = [];
for (let n = 0; n < 400; n++) {
  const setup = pick(['1', '1ipo', '2', '3', '4']);
  const light = pick(['green', 'yellow', 'red', null]);
  const basis = +(20 + rnd() * 2000).toFixed(2);
  const chartStop = +(basis * (0.85 + rnd() * 0.14)).toFixed(2);
  const withAtr = rnd() < 0.8;
  const atr = withAtr ? +(basis * (0.005 + rnd() * 0.06)).toFixed(2) : undefined;
  const close = rnd() < 0.7 ? +(basis * (0.95 + rnd() * 0.05)).toFixed(2) : undefined;
  const resistance = rnd() < 0.7 ? +(basis * (1.02 + rnd() * 0.3)).toFixed(2) : undefined;
  const capital = pick([300000, 980000, 2500000]);
  const riskBase = pick([0.25, 0.5, 1, 0.125]);
  const sector = pick([null, { persist: true, newLeader: false, above200: true }, { persist: false, newLeader: true, above200: true }, { persist: true, newLeader: false, above200: false }, { persist: false, newLeader: false, above200: null }]);
  const bottomUp = rnd() < 0.2;
  const inp = { setup, basis, chartStop, atr, close, resistance, capital, light, riskBase, sector, bottomUp };
  state.nt = { setup, basis: String(basis), stop: String(chartStop), atr: atr === undefined ? '' : String(atr), close: close === undefined ? '' : String(close), resistance: resistance === undefined ? '' : String(resistance), sector: sector ? 'S' : '', bottomUp: bottomUp ? 'yes' : 'no' };
  state.L = light ? { name: light, risk: riskBase } : null; state.cap = capital; state.ss = sector;
  const o = ctx.ntCalc();
  const { setup: _s, L: _l, ss: _ss, ...res } = o;
  cases.push({ input: inp, expected: JSON.parse(JSON.stringify(res, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN' : v))) });
}
writeFileSync('fixtures/expected/ntcalc-v9.json', JSON.stringify({ generatedBy: 'v9 ntCalc, seeded grid', cases }));
console.log(cases.length, 'cases');
