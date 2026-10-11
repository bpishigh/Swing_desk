// Runs the ORIGINAL v9 evaluate() (exit rules) and journal functions (equityCurve, halvingState, statsFor, freshMoney)
// on seeded random inputs; writes fixtures/expected/exits-v9.json and journal-v9.json.
// Usage: node tools/make-v9-exits-golden.mjs fixtures/app/swing-desk-v9.html
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(process.argv[2], 'utf8');
const line = (re) => html.match(re)[0];
const grab = (a, b) => { const i = html.search(a); const r = html.slice(i); return r.slice(0, r.search(b)); };
const code = [
  line(/const num = [^\n]+/), line(/const ok = [^\n]+/),
  line(/const px = [^\n]+/), line(/const pct = [^\n]+/), line(/const rr = [^\n]+/), line(/const parseD = [^\n]+/),
  grab(/function weekdaysBetween/, /\nconst daysBetween/), line(/const daysBetween = [^\n]+/),
  grab(/const SETUPS = \{/, /\nconst LV = /),
  grab(/function held\(t\)/, /\nfunction openRiskRs/),
  grab(/function equityCurve\(\)/, /\nfunction freshMoney/),
  grab(/function freshMoney\(\)/, /\n\}\n/) + '\n}',
  line(/const SELLNEXT=[^\n]+/), line(/const STOPWORD=[^\n]+/),
  grab(/function evaluate\(t,ev\)/, /\nfunction ltDate/),
].join('\n');
const st = { closed: [], cap: 0, dropped: false };
const ctx = { MKT: 'india', TODAY: '2026-10-05', US: () => ctx.MKT === 'us', closedTrades: () => st.closed, startCapital: () => st.cap, regimeDroppedToday: () => st.dropped, TR: () => ({}) };
vm.createContext(ctx);
vm.runInContext(code + '\nthis.evaluate=evaluate; this.equityCurve=equityCurve; this.halvingState=halvingState; this.freshMoney=freshMoney; this.statsFor=statsFor;', ctx);
let seed = 424242; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, k) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + k); return iso(x); };
const clean = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'NaN' : x === undefined ? null : x)));

const exits = [];
for (let n = 0; n < 700; n++) {
  const market = pick(['india', 'us']); ctx.MKT = market;
  const E = +(30 + rnd() * 1500).toFixed(2);
  const R = +(E * (0.02 + rnd() * 0.07)).toFixed(2);
  const stop0 = +(E - R).toFixed(2);
  const full = Math.floor(100 + rnd() * 900);
  const first = Math.floor(full * 0.6);
  const entryDate = addDays('2026-10-05', -Math.floor(rnd() * 90));
  const stop = +(stop0 + (rnd() < 0.4 ? R * (rnd() * 1.2) : 0)).toFixed(2);
  const thirdSold = rnd() < 0.35;
  const sold = thirdSold ? Math.floor(first / 3) : 0;
  const t = {
    setup: pick(['1', '1ipo', '2', '3', '4']), entryDate, stop0, stop, pivot: rnd() < 0.8 ? +(E * (0.97 + rnd() * 0.05)).toFixed(2) : undefined,
    lots: [{ date: entryDate, shares: first, price: E, kind: 'first' }], sells: sold ? [{ date: entryDate, shares: sold, price: E + 2 * R, rule: '5' }] : [],
    maxClose: rnd() < 0.9 ? +(E + R * (rnd() * 3 - 0.5)).toFixed(2) : undefined, added: rnd() < 0.2, thirdSold, extSold: rnd() < 0.15,
    addShares: rnd() < 0.8 ? full - first : 0, gttPlaced: rnd() < 0.7,
    resultsDate: rnd() < 0.3 ? addDays('2026-10-05', Math.floor(rnd() * 6) - 1) : undefined,
  };
  const close = rnd() < 0.92 ? +(E + R * (rnd() * 4 - 1.5)).toFixed(2) : undefined;
  const o = (m) => (rnd() < 0.8 ? +(E * m * (0.9 + rnd() * 0.25)).toFixed(2) : undefined);
  const ev = { close, ema21: o(1), ema10: o(1), prevLow: o(0.98), wk10: o(1), wkClose: o(1), climax: rnd() < 0.1, emaApprox: rnd() < 0.2 };
  const dropped = rnd() < 0.3; st.dropped = dropped;
  const evV9 = { close: close === undefined ? '' : close, ema21: ev.ema21 ?? '', ema10: ev.ema10 ?? '', prevLow: ev.prevLow ?? '', wk10: ev.wk10 ?? '', wkClose: ev.wkClose ?? '', climax: ev.climax, _emaApprox: ev.emaApprox };
  const tV9 = { ...t, pivot: t.pivot === undefined ? undefined : t.pivot, maxClose: t.maxClose };
  const res = ctx.evaluate(tV9, evV9);
  exits.push({ market, dropped, trade: t, ev, expected: clean(res) });
}
writeFileSync('fixtures/expected/exits-v9.json', JSON.stringify({ generatedBy: 'v9 evaluate(), seeded', today: '2026-10-05', cases: exits }));

const journal = [];
for (let n = 0; n < 250; n++) {
  const count = Math.floor(rnd() * 45);
  const startCapital = pick([300000, 980000, 2500000]);
  let d = '2026-01-05'; const closed = [];
  for (let k = 0; k < count; k++) {
    const E = +(50 + rnd() * 800).toFixed(2); const R = +(E * (0.03 + rnd() * 0.05)).toFixed(2); const full = Math.floor(80 + rnd() * 400);
    const entry = d; d = addDays(d, Math.floor(rnd() * 6)); const exit = addDays(entry, 2 + Math.floor(rnd() * 20)); if (exit > d) d = exit;
    const rMult = rnd() < 0.45 ? rnd() * 3.5 : -(rnd() * 1.4);
    const exitPx = +(E + R * rMult).toFixed(2);
    closed.push({ entryDate: entry, exitDate: exit, stop0: +(E - R).toFixed(2), fullShares: rnd() < 0.9 ? full : undefined, lots: [{ date: entry, shares: full, price: E }], sells: [{ date: exit, shares: full, price: exitPx }], rulesFollowed: rnd() < 0.85 });
  }
  closed.sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  st.closed = closed; st.cap = startCapital;
  journal.push({ startCapital, closed, expected: clean({ eq: ctx.equityCurve(), halving: ctx.halvingState(), stats: ctx.statsFor(closed), fresh: ctx.freshMoney() }) });
}
writeFileSync('fixtures/expected/journal-v9.json', JSON.stringify({ generatedBy: 'v9 equityCurve/halvingState/statsFor/freshMoney, seeded', cases: journal }));
console.log(exits.length, 'exit cases;', journal.length, 'journal sets');
