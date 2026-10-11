// Runs ORIGINAL v9 code for the legacy book (legacyRow advice, legacyGiveBack), openRiskRs, bookCount, currentLimits and
// regimeDroppedToday on seeded random inputs; writes fixtures/expected/book-v9.json.
// Usage: node tools/make-v9-book-golden.mjs fixtures/app/swing-desk-v9.html
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(process.argv[2], 'utf8');
const line = (re) => html.match(re)[0];
const grab = (a, b) => { const i = html.search(a); const r = html.slice(i); return r.slice(0, r.search(b)); };
const code = [
  line(/const num = [^\n]+/), line(/const ok = [^\n]+/), line(/const px = [^\n]+/), line(/const pct = [^\n]+/), line(/const rr = [^\n]+/), line(/const parseD = [^\n]+/),
  line(/const LVNAME = [^\n]+/), line(/const LV = [^\n]+/),
  grab(/function weekdaysBetween/, /\nconst daysBetween/), line(/const daysBetween = [^\n]+/),
  grab(/const LIMITS = \{/, /\nconst SECTORS_US/), grab(/const LIMITS_US = \{/, /\nconst SECT = /),
  grab(/function regimeHistory/, /\nfunction regimeDroppedToday/), grab(/function regimeDroppedToday/, /\nfunction closedTrades/),
  grab(/function held\(t\)/, /\nfunction equityCurve/),
  grab(/function equityCurve\(\)/, /\nfunction freshMoney/),
  grab(/function freshMoney\(\)/, /\n\}\n/) + '\n}',
  grab(/function currentLimits\(\)/, /\nfunction latestSectors/),
  grab(/function chg\(r,p\)/, /function trackerRegime/), line(/function trackerRegime\(\)[^\n]+/), line(/function trackerDropped\(\)[^\n]+/),
  line(/function bookCount\(\)[^\n]+/),
  grab(/function legacyRow\(l,cap,counts\)/, /\n\/\* ---------- WEEKEND/),
].join('\n');
const st = { open: [], closed: [], cap: 0, rows: [], rg: {}, feed: {}, legacy: {} };
const ctx = {
  MKT: 'india', TODAY: '2026-10-05', US: () => ctx.MKT === 'us', S: { legacy: {} },
  RG: () => st.rg, trackRows: () => st.rows, openTrades: () => st.open, closedTrades: () => st.closed, startCapital: () => st.cap, feedStock: (s) => st.feed[s] || null,
  esc: (s) => String(s == null ? '' : s), fmtDate: (d) => d, FD: () => ({ date: '2026-10-05' }), vsLevel: () => '', sig: () => '', inr: (n) => String(n),
  IDX: () => ({ a: 'A', b: 'B' }),
};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.legacyRow=legacyRow; this.legacyGiveBack=legacyGiveBack; this.openRiskRs=openRiskRs; this.bookCount=bookCount; this.currentLimits=currentLimits; this.regimeDroppedToday=regimeDroppedToday;', ctx);
let seed = 777001; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const r2 = (x) => +x.toFixed(2);
const clean = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'NaN' : x === undefined ? null : x)));
const maybe = (p, f) => (rnd() < p ? f() : undefined);
const SECS = ['IT', 'Bank', 'Auto', 'Pharma', 'Metal'];
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// A. legacy advice
const legacy = [];
for (let n = 0; n < 700; n++) {
  const avg = r2(50 + rnd() * 1500); const p = r2(avg * (0.6 + rnd() * 0.9));
  const l = { qty: Math.floor(10 + rnd() * 900), avg, stock: 'S' + n, symbol: 'SYM' + n, tax: 'LT', bucket: pick(['Sell now', 'Sell this FY', 'Sell from Apr 2027', 'Keep', '']), sector: pick(SECS),
    status: pick([undefined, 'unchecked', 'pass', 'pass', 'fail', 'exited']),
    price: maybe(0.8, () => p), close: maybe(0.5, () => r2(p * 0.99)), priceDate: maybe(0.6, () => pick(['2026-09-26', '2026-10-01', '2026-10-05'])),
    stop: maybe(0.7, () => r2(p * (0.7 + rnd() * 0.35))), wk10: maybe(0.5, () => r2(p * (0.85 + rnd() * 0.2))), swingLow: maybe(0.6, () => r2(p * (0.8 + rnd() * 0.2))) };
  const f = maybe(0.8, () => ({ close: maybe(0.9, () => r2(p * (0.9 + rnd() * 0.2))), date: pick(['2026-09-30', '2026-10-01', '2026-10-05']), sma50: maybe(0.8, () => r2(p * (0.9 + rnd() * 0.2))), sma200: maybe(0.8, () => r2(p * (0.8 + rnd() * 0.4))) }));
  const cap = pick([300000, 980000, 2500000]); const counts = { [l.sector]: Math.floor(rnd() * 6) };
  st.feed = { [l.symbol]: f || undefined };
  const h = ctx.legacyRow({ id: 'x', ...l }, cap, { sec: counts, ind: {} });
  const todo = unesc(h.match(/<td class="small" style="min-width:220px">([\s\S]*?)<\/td>/)[1]);
  const gbp = h.match(/<td class="n">([^<]*)<\/td><td class="small" style="min-width/)[1];
  const price = h.match(/data-l="price" value="([^"]*)"/)[1];
  const gain = [...h.matchAll(/<td class="n (?:pos|neg)">([^<]*)<\/td>/g)].pop()[1];
  legacy.push({ l, f: f || null, cap, counts, expected: { todo, gbp, price, gain } });
}

// B. book numbers
const books = [];
for (let n = 0; n < 250; n++) {
  const docs = Array.from({ length: Math.floor(rnd() * 9) }, (_, k) => {
    const avg = r2(50 + rnd() * 900); const p = r2(avg * (0.7 + rnd() * 0.7));
    return { id: 'l' + k, symbol: 'Q' + k, qty: Math.floor(10 + rnd() * 500), avg, status: pick([undefined, 'unchecked', 'pass', 'pass', 'fail', 'exited']),
      price: maybe(0.8, () => p), close: maybe(0.4, () => p), priceDate: maybe(0.6, () => pick(['2026-09-26', '2026-10-05'])), stop: maybe(0.75, () => r2(p * (0.7 + rnd() * 0.4))) };
  });
  const feed = {}; docs.forEach((d) => { if (rnd() < 0.7) feed[d.symbol] = { close: maybe(0.9, () => r2(d.avg * (0.7 + rnd() * 0.7))), date: pick(['2026-09-30', '2026-10-05']) }; });
  const open = Array.from({ length: Math.floor(rnd() * 8) }, () => {
    const E = r2(50 + rnd() * 900); const sh = Math.floor(20 + rnd() * 400); const sold = rnd() < 0.3 ? Math.floor(sh / 3) : sh + (rnd() < 0.05 ? 0 : 0);
    return { stop: maybe(0.85, () => r2(E * (0.85 + rnd() * 0.3))), lots: [{ shares: sh, price: E }, ...(rnd() < 0.4 ? [{ shares: Math.floor(sh / 2), price: r2(E * 1.05) }] : [])], sells: rnd() < 0.3 ? [{ shares: Math.min(sold, sh), price: E }] : [] };
  });
  st.feed = feed; st.open = open; ctx.S.legacy = Object.fromEntries(docs.map((d) => [d.id, d]));
  const out = { legacyGiveBack: ctx.legacyGiveBack(), openRisk: ctx.openRiskRs() };
  ctx.MKT = 'india'; out.bookIndia = ctx.bookCount(); ctx.MKT = 'us'; out.bookUs = ctx.bookCount(); ctx.MKT = 'india';
  books.push({ docs, feed, open, expected: clean(out) });
}

// C. limits and regime drop on synthetic tracker series
const addDays = (s, k) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + k); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
function series(n) {
  const dates = []; let d = '2026-10-05'; while (dates.length < n) { const w = new Date(d + 'T00:00:00').getDay(); if (w !== 0 && w !== 6) dates.unshift(d); d = addDays(d, -1); }
  const mk = (start, drift, vol) => { let c = start; const cl = []; for (let i = 0; i < n; i++) { c *= 1 + drift + (rnd() - 0.5) * vol; cl.push(r2(c)); } return cl; };
  const drift = (rnd() - 0.45) * 0.002;
  const a = mk(20000, drift, 0.02), b = mk(15000, drift, 0.022);
  const avg = (arr, i, w) => (i >= w ? r2(arr.slice(i - w, i).reduce((s, x) => s + x, 0) / w) : undefined);
  let vol = 250;
  return dates.map((date, i) => {
    vol = r2(Math.max(100, vol * (1 + (rnd() - 0.5) * 0.4)));
    const row = { date, close: a[i], high: r2(a[i] * 1.004), low: r2(a[i] * 0.994), volume: vol, sma50: avg(a, i, 50), sma200: avg(a, i, 200),
      b: { close: b[i], sma50: avg(b, i, 50), sma200: avg(b, i, 200) } };
    if (rnd() < 0.35) row.breadth = r2(20 + rnd() * 60);
    if (rnd() < 0.8) row.vix = r2(11 + rnd() * 17);
    if (rnd() < 0.05) row.skip = true;
    return row;
  });
}
const limits = [];
const fullA = series(260);
for (let n = 0; n < 300; n++) {
  const market = pick(['india', 'us']); ctx.MKT = market;
  const useRows = rnd() < 0.7; const len = 30 + Math.floor(rnd() * 231);
  let rows = useRows ? fullA.slice(0, len).map((r) => ({ ...r, b: { ...r.b } })) : [];
  const dropSma50 = rows.length > 0 && rnd() < 0.15; if (dropSma50) delete rows[rows.length - 1].sma50;
  const saved = {}; if (rnd() < 0.7) saved['2026-10-05'] = { result: pick(['red', 'yellow', 'green']), vix: maybe(0.6, () => r2(12 + rnd() * 16)) };
  for (const k of ['2026-10-01', '2026-10-02', '2026-09-30']) if (rnd() < 0.6) saved[k] = { result: pick(['red', 'yellow', 'green']), vix: maybe(0.6, () => r2(12 + rnd() * 16)) };
  const cnt = Math.floor(rnd() * 50); const startCapital = pick([300000, 980000]); let d = '2026-01-05'; const closed = [];
  for (let k = 0; k < cnt; k++) {
    const E = r2(50 + rnd() * 800), R = r2(E * (0.03 + rnd() * 0.05)), full = Math.floor(80 + rnd() * 400); const entry = d; const exit = addDays(entry, 2 + Math.floor(rnd() * 20)); d = addDays(d, 1 + Math.floor(rnd() * 3)); if (exit > d) d = exit;
    const mult = rnd() < (n % 3 === 0 ? 0.25 : 0.55) ? rnd() * 3.5 : -(rnd() * 1.4);
    closed.push({ entryDate: entry, exitDate: exit, stop0: r2(E - R), fullShares: full, lots: [{ date: entry, shares: full, price: E }], sells: [{ date: exit, shares: full, price: r2(E + R * mult) }], rulesFollowed: rnd() < 0.9 });
  }
  closed.sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  st.rows = rows; st.rg = saved; st.closed = closed; st.cap = startCapital;
  limits.push({ market, len: useRows ? len : 0, dropSma50, saved, closed, startCapital, expected: clean({ limits: ctx.currentLimits(), dropped: ctx.regimeDroppedToday() }) });
}
writeFileSync('fixtures/expected/book-v9.json', JSON.stringify({ generatedBy: 'v9 legacyRow/legacyGiveBack/openRiskRs/bookCount/currentLimits/regimeDroppedToday, seeded', today: '2026-10-05', series: fullA, legacy, books, limits }));
console.log(legacy.length, 'legacy;', books.length, 'books;', limits.length, 'limits;', limits.filter((x) => x.expected.limits).length, 'with limits;', limits.filter((x) => x.expected.dropped).length, 'dropped;', limits.filter((x) => x.expected.limits && x.expected.limits.why.length).length, 'with adjustments');
