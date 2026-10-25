// Weekly fund scoring: (1) Direct-Growth equity/hybrid funds against their category, (2) index funds and ETFs against others tracking the same index,
// (3) a curated list of US-listed ETFs an Indian resident can buy through LRS, against their category. NAV/price history from mfapi.in and Nasdaq.
// Writes data/funds/scores.json (public data) and the monthly band history for the Replace hysteresis. Usage: node scripts/fund-scores.mjs [--limit N]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { themeOf } from '../src/pm/fundtheme.ts';
import { normCategory, scorable, scoreAll, scoreIndexGroups, indexKey, replaceCandidate, SETTINGS, INDEX_SETTINGS } from '../src/pm/fundscore.ts';
import { scoreRisk, debtGroup, intlGroup, riskStats, RISK } from '../src/pm/fundrisk.ts';
import { nasdaqBars } from './nasdaq.mjs';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const amfi = J('data/rules/amfi-schemes.json');
const asOf = new Date().toISOString().slice(0, 10);
const SNAP = Date.parse((amfi.asOf ?? new Date().toISOString().slice(0, 10)) + 'T23:59:59Z');   // freshness is judged against the AMFI file's own date, not today's (it was empty 12 days after each manual refresh)
if (Date.now() - SNAP > 35 * 86400000) { console.error('AMFI scheme list is more than 35 days old (' + amfi.asOf + '): refresh it first'); process.exit(1); }
const recent = (s) => { const [d, m, y] = s.split('-'); const t = Date.parse(`${d} ${m} ${y} UTC`); return Number.isFinite(t) && SNAP - t < 12 * 86400000; };
const row = (r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] });
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));   // schemes AMFI lists with no plan, settled by NAV ordering
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const isEtfRow = (r) => r[5] === '' && /\bETF\b|BeES|Exchange Traded/i.test(r[3]) && !/IDCW|dividend/i.test(r[3]);
let mf = amfi.rows.filter((r) => direct(r) && recent(r[8]) && scorable(normCategory(r[4]))).map(row);
let idx = amfi.rows.filter((r) => (direct(r) || isEtfRow(r)) && recent(r[8]) && /index|etf|bees|exchange traded/i.test(r[3] + r[4]) && !/fund of fund/i.test(r[3]) && indexKey(r[3])).map(row);
// C-82: debt and liquid funds and international fund-of-funds, scored on return, consistency, risk-adjusted return, downside and cost inside their group.
let debt = amfi.rows.filter((r) => direct(r) && recent(r[8]) && debtGroup(r[4])).map(row);
const recentIntl = (d) => { const [dd, m, y] = d.split('-'); const t = Date.parse(`${dd} ${m} ${y} UTC`); return Number.isFinite(t) && Date.now() - t < 35 * 86400000; };   // overseas fund-of-funds publish NAVs with a lag of one to two weeks
let intl = amfi.rows.filter((r) => direct(r) && recentIntl(r[8]) && intlGroup(r[3], r[4])).map(row);
const lim = process.argv.indexOf('--limit'); if (lim > 0) { mf = mf.slice(0, Number(process.argv[lim + 1])); idx = idx.slice(0, Number(process.argv[lim + 1])); debt = debt.slice(0, Number(process.argv[lim + 1])); intl = intl.slice(0, Number(process.argv[lim + 1])); }
// US-listed ETFs (price only, split-adjusted; dividends not included, so distributing ETFs read a little low). Category is the comparison group.
const US = {
  'US large cap blend': ['SPY', 'VOO', 'IVV', 'SPLG', 'VTI', 'ITOT', 'SCHB', 'DIA'], 'US Nasdaq-100': ['QQQ', 'QQQM'],
  'US mid cap': ['IJH', 'VO', 'MDY', 'SCHM'], 'US small cap': ['IJR', 'VB', 'IWM', 'SCHA'],
  'US large growth': ['VUG', 'IWF', 'SCHG', 'MGK'], 'US large value': ['VTV', 'IWD', 'SCHV'], 'US dividend': ['SCHD', 'VIG', 'VYM', 'DGRO', 'HDV', 'NOBL'],
  'US semiconductors and tech': ['SMH', 'SOXX', 'XLK', 'VGT', 'IGV'], 'International developed': ['VEA', 'IEFA', 'EFA', 'SCHF', 'VXUS'], 'Emerging markets': ['VWO', 'IEMG', 'EEM', 'SCHE'],
  'India (US-listed)': ['INDA', 'EPI', 'SMIN', 'INDY'], 'US bonds': ['AGG', 'BND', 'TLT', 'IEF', 'LQD'], 'Gold and silver': ['GLD', 'IAU', 'GLDM', 'SLV'], 'US real estate': ['VNQ', 'XLRE', 'SCHH'],
};
const usSchemes = Object.entries(US).flatMap(([cat, syms]) => syms.map((s) => ({ code: s, isin: '', name: s, category: cat })));
const US_NAME = { SPY: 'SPDR S&P 500', VOO: 'Vanguard S&P 500', IVV: 'iShares Core S&P 500', SPLG: 'SPDR Portfolio S&P 500', VTI: 'Vanguard Total US Stock Market', ITOT: 'iShares Core S&P Total US', SCHB: 'Schwab US Broad Market', DIA: 'SPDR Dow Jones Industrial Average', QQQ: 'Invesco QQQ (Nasdaq-100)', QQQM: 'Invesco Nasdaq 100', IJH: 'iShares Core S&P Mid-Cap', VO: 'Vanguard Mid-Cap', MDY: 'SPDR S&P MidCap 400', SCHM: 'Schwab US Mid-Cap', IJR: 'iShares Core S&P Small-Cap', VB: 'Vanguard Small-Cap', IWM: 'iShares Russell 2000', SCHA: 'Schwab US Small-Cap', VUG: 'Vanguard Growth', IWF: 'iShares Russell 1000 Growth', SCHG: 'Schwab US Large-Cap Growth', MGK: 'Vanguard Mega Cap Growth', VTV: 'Vanguard Value', IWD: 'iShares Russell 1000 Value', SCHV: 'Schwab US Large-Cap Value', SCHD: 'Schwab US Dividend Equity', VIG: 'Vanguard Dividend Appreciation', VYM: 'Vanguard High Dividend Yield', DGRO: 'iShares Core Dividend Growth', HDV: 'iShares Core High Dividend', NOBL: 'ProShares S&P 500 Dividend Aristocrats', SMH: 'VanEck Semiconductor', SOXX: 'iShares Semiconductor', XLK: 'Technology Select Sector SPDR', VGT: 'Vanguard Information Technology', IGV: 'iShares Expanded Tech-Software', VEA: 'Vanguard FTSE Developed Markets', IEFA: 'iShares Core MSCI EAFE', EFA: 'iShares MSCI EAFE', SCHF: 'Schwab International Equity', VXUS: 'Vanguard Total International Stock', VWO: 'Vanguard FTSE Emerging Markets', IEMG: 'iShares Core MSCI Emerging Markets', EEM: 'iShares MSCI Emerging Markets', SCHE: 'Schwab Emerging Markets Equity', INDA: 'iShares MSCI India', EPI: 'WisdomTree India Earnings', SMIN: 'iShares MSCI India Small-Cap', INDY: 'iShares India 50', AGG: 'iShares Core US Aggregate Bond', BND: 'Vanguard Total Bond Market', TLT: 'iShares 20+ Year Treasury Bond', IEF: 'iShares 7-10 Year Treasury Bond', LQD: 'iShares Investment Grade Corporate Bond', GLD: 'SPDR Gold Shares', IAU: 'iShares Gold Trust', GLDM: 'SPDR Gold MiniShares', SLV: 'iShares Silver Trust', VNQ: 'Vanguard Real Estate', XLRE: 'Real Estate Select Sector SPDR', SCHH: 'Schwab US REIT' };

console.log('schemes to fetch: mf', mf.length, 'index/etf', idx.length, 'debt', debt.length, 'intl', intl.length, 'us etf', usSchemes.length);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
const fetchMf = async (s) => {
  if (series.has(s.code)) return;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json(); const m = {};
      for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; }
      if (Object.keys(m).length) series.set(s.code, m); return;
    } catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
};
const usSeries = new Map(); let usFailed = 0;
const fetchUs = async (s) => {
  for (let a = 0; a < 3; a++) {
    try { const { bars } = await nasdaqBars(s.code, 'etf', '2019-06-01'); const m = {}; for (const b of bars) if (b[4] > 0) m[b[0]] = b[4]; if (Object.keys(m).length > 250) usSeries.set(s.code, m); return; }
    catch { if (a === 2) usFailed++; else await new Promise((r) => setTimeout(r, 1500 * (a + 1))); }
  }
};
await pool([...mf, ...idx, ...debt, ...intl], fetchMf, 8);
await pool(usSchemes, fetchUs, 3);
// A one-day move over 40% in a fund's NAV is a data break (unit split or consolidation, bad print), not performance: leave that scheme out rather than score it on a false return.
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const mp of [series, usSeries]) for (const [k, m] of [...mp]) { const b = broken(m); if (b) { console.log('dropped (data break on', b + '):', k); mp.delete(k); } }
const need = [...new Set([...mf, ...idx, ...debt, ...intl].map((x) => x.code))].length;
console.log('india fetched', series.size, 'of', need, 'failed', failed, '| us fetched', usSeries.size, 'of', usSchemes.length, 'failed', usFailed);
{ const prev = existsSync('data/funds/scores.json') ? JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds?.length ?? 0 : 0; if (prev && need < prev * 0.8) { console.error(`the universe shrank from ${prev} funds to ${need}: keeping the previous scores`); process.exit(1); } }
if (series.size < need * 0.8) { console.error('too many India fetch failures; keeping the previous scores'); process.exit(1); }
const prev = J('data/funds/scores.json', null);
const hist = J('data/funds/history.json', {}), month = asOf.slice(0, 7);
// C-105: sectoral and thematic funds are ranked only against funds of their own theme (5 funds needed); a fund whose name gives no theme is not scored. Everything else is ranked in its category as before.
const isTh = (x) => normCategory(x.category) === 'Sectoral/Thematic';
const mfScored = [...scoreAll(mf.filter((x) => !isTh(x)), series, asOf), ...scoreAll(mf.filter(isTh), series, asOf, { ...SETTINGS, minPeers: 5 }, (x) => { const t = themeOf(x.name); return t ? 'Thematic · ' + t : null; })];
hist[month] = Object.fromEntries(mfScored.filter((x) => x.band).map((x) => [x.code, x.band]));
for (const x of mfScored) if (x.band === 'Weak' && replaceCandidate(hist, x.code)) x.replace = true;
const idxScored = scoreIndexGroups(idx, series, asOf);
// Risk facts for equity and index funds (scope K2): worst 3-year fall, volatility and worst day from the NAV history. Shown only; they take no part in the score (the risk-aware score failed its test, C-94).
for (const x of [...mfScored, ...idxScored]) { const st = series.has(x.code) ? riskStats(series.get(x.code), asOf) : null; if (st) { x.dd = st.dd; x.vol = st.vol; x.wd = st.wd; } }
const terFile0 = J('data/funds/ter.json', null), nn0 = (x) => x.toLowerCase().replace(/direct plan|regular plan|growth option|growth plan|growth|idcw|option|plan|fund/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const terBy = new Map(); if (terFile0) for (const r of terFile0.rows) if (r.dir != null) terBy.set(nn0(r.n), r.dir);
const terByCode = new Map([...debt, ...intl].map((x) => [x.code, terBy.get(nn0(x.name))]).filter((e) => e[1] != null));
const debtScored = scoreRisk(debt, series, asOf, (x) => debtGroup(x.category), terByCode, () => RISK.minPeersDebt, () => true);
const intlScored = scoreRisk(intl, series, asOf, (x) => intlGroup(x.name, x.category), terByCode, () => RISK.minPeersIntl, () => false);
let usScored;
if (usSeries.size >= usSchemes.length * 0.7) usScored = scoreAll(usSchemes, usSeries, asOf, { ...SETTINGS, minPeers: 3 }, (x) => x.category).map((x) => ({ ...x, name: US_NAME[x.code] ? `${x.code} · ${US_NAME[x.code]}` : x.code }));
else { console.error('US ETF fetch too thin; keeping the previous US scores'); usScored = (prev?.funds || []).filter((x) => x.g === 'us'); }
// Expense ratios (AMFI, matched by scheme name): direct-plan TER for funds, the single TER for ETFs. Index groups also get the gap before costs.
const terFile = J('data/funds/ter.json', null);
const nn = (x) => x.toLowerCase().replace(/direct plan|regular plan|growth option|growth plan|growth|idcw|option|plan|fund/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
if (terFile) {
  const by = new Map(); for (const r of terFile.rows) by.set(nn(r.n), r);
  const apply = (arr) => { let hit = 0; for (const x of arr) { const r = by.get(nn(x.name)); if (!r) continue; const etf = /\bETF\b|BeES|Exchange Traded/i.test(x.name); const v = etf ? (r.dir ?? r.reg) : r.dir; if (v != null) { x.ter = v; hit++; } } console.log('TER matched', hit, 'of', arr.length); };
  apply(mfScored); apply(idxScored);
  const grp = new Map(); for (const x of idxScored) if (x.ter != null && x.rank) (grp.get(x.cat) ?? grp.set(x.cat, []).get(x.cat)).push(x.ter);
  const med = (a) => { const t = [...a].sort((p, q) => p - q), m = t.length >> 1; return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
  for (const x of idxScored) if (x.ter != null && x.d3 != null && grp.get(x.cat)?.length >= 3) x.d3g = x.d3 + (x.ter - med(grp.get(x.cat)));
}
// History keeps the band of every scored fund (not only active equity) so the two-review rule for picks can use it. The month's entry is overwritten each day: the month-end run stands.
for (const arr of [idxScored, debtScored, intlScored]) for (const x of arr) if (x.band) (hist[month] ??= {})[x.code] = x.band;
const prevMonth = Object.keys(hist).filter((k) => k < month).sort().pop() ?? null;
const withPrev = (arr) => arr.map((x) => (prevMonth ? { ...x, pb: hist[prevMonth][x.code] ?? null } : x));
const tag = (arr, g) => withPrev(arr).map((x) => ({ ...x, g }));
mkdirSync('data/funds', { recursive: true });
const all = [...tag(mfScored, 'mf'), ...tag(idxScored, 'idx'), ...tag(usScored, 'us'), ...tag(debtScored, 'debt'), ...tag(intlScored, 'intl')];
writeFileSync('data/funds/scores.json', JSON.stringify({ asOf, prevMonth, version: 'FUND-3', source: 'AMFI scheme list; NAV history from mfapi.in; US ETF prices from Nasdaq', funds: all }) + '\n');
writeFileSync('data/funds/history.json', JSON.stringify(hist) + '\n');
console.log('scored', all.filter((x) => x.score !== null).length, 'of', all.length);
