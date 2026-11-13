// One-off (US filings loader): real SEC company-facts files for a few companies, trimmed to the concepts the parser reads, saved under fixtures/us-facts. Manual only. Public data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { trim } from '../src/ingest/edgar-facts.ts';
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };
const WANT = ['AAPL', 'JPM', 'MSFT', 'WMT', 'NVDA', 'XOM'];   // Sep FY, bank, Jun FY, Jan FY, Jan FY with a split, Dec FY
const tickers = await get('https://www.sec.gov/files/company_tickers.json'), map = {}; for (const v of Object.values(tickers)) map[v.ticker] = String(v.cik_str).padStart(10, '0');
mkdirSync('fixtures/us-facts', { recursive: true }); const log = {};
for (const t of WANT) { try { const cf = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${map[t]}.json`); const small = trim(cf); writeFileSync(`fixtures/us-facts/${t}.json`, JSON.stringify(small)); log[t] = { bytes: JSON.stringify(small).length, concepts: Object.keys(small.facts['us-gaap']).length }; } catch (e) { log[t] = { error: String(e.message) }; } await sleep(300); }
console.log(JSON.stringify(log));
