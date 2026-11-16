// One-off probe (US Batch B coverage): for names with missing figures, which concept tags and period ends the SEC company facts actually hold. Writes data/us/probe-gaps.json. Manual only; public data.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };
const WANT = ['LLY', 'COST', 'XOM', 'JNJ', 'MRK', 'PEP', 'IBM', 'COP', 'NKE', 'TJX', 'GE', 'ETN', 'KLAC', 'NEM', 'CVX', 'PFE'];
const tickers = await get('https://www.sec.gov/files/company_tickers.json'), map = {}; for (const v of Object.values(tickers)) map[v.ticker] = String(v.cik_str).padStart(10, '0');
const out = {};
for (const t of WANT) { try {
  const g = (await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${map[t]}.json`)).facts?.['us-gaap'] ?? {}, names = Object.keys(g);
  const fam = (re) => names.filter((n) => re.test(n));
  const ends = (c, unit = 'USD') => { const rows = g[c]?.units?.[unit] ?? []; const o = {}; for (const r of rows) { if (!/^10-[QK]/.test(r.form) || r.end < '2024-06-01') continue; const k = r.end + (r.start ? ':' + Math.round((Date.parse(r.end) - Date.parse(r.start)) / 864e5) + 'd' : ':inst'); o[k] = (o[k] ?? 0) + 1; } return Object.keys(o).sort(); };
  out[t] = { opIncome: ends('OperatingIncomeLoss'), tagsOperating: fam(/Operating(Income|Expenses)|CostsAndExpenses|GrossProfit/), ppeTags: fam(/PropertyPlant/).slice(0, 12), debtTags: fam(/Debt|Notes|Borrow/).slice(0, 25), revenueEnds: ends(names.find((n) => /^Revenue/.test(n) && g[n]?.units?.USD?.length > 40) ?? 'Revenues'), patEnds: ends('NetIncomeLoss') };
  await sleep(300); } catch (e) { out[t] = { error: String(e) }; } }
mkdirSync('data/us', { recursive: true }); writeFileSync('data/us/probe-gaps.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length);
