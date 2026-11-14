// One-off probe (Batch B definitions, 14 Nov 2026): which balance-sheet tags do the integrated-filing XBRL files carry for (a) liquid investments held as current investments, (b) lease liabilities, (c) the older Sep 2021 files, where the stored extras have cash-flow figures but no balance sheet (is the gap the source or our tag list?).
// Writes data/probe-bs-tags.json. Public data only. Read-only; changes no rule.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const get = async (url, h) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(60000) }); return { status: r.status, t: await r.text() }; } catch { return { status: 0, t: '' }; } };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
const SYMS = ['INFY','TCS','WIPRO','HCLTECH','HINDUNILVR','ITC','NESTLEIND','DMART','TRENT','JUBLFOOD','DEVYANI','INDIGO','TITAN','MARUTI','RELIANCE','BAJAJ-AUTO','HEROMOTOCO','ASIANPAINT','PIDILITIND','DABUR','COLPAL','SUNPHARMA','DRREDDY','CIPLA','LUPIN','LT','ULTRACEMCO','ADANIPORTS','BHARTIARTL','APOLLOHOSP','PAGEIND','BATAINDIA','VBL','SIEMENS','HAL','BEL','COALINDIA','ONGC','TATASTEEL','HINDALCO','GODREJCP','MARICO','BRITANNIA','KPITTECH','PERSISTENT','COFORGE','MPHASIS','TATACONSUM','EICHERMOT','TVSMOTOR'];
const PERIODS = ['2026-03-31', '2025-09-30', '2021-09-30'];
const RX = /Invest|Lease|Cash|Bank|Borrow|Deposit|Liquid|Mutual|^Assets$|Equity|CurrentAssets|CurrentLiabilities|PropertyPlant|RightOfUse/i;
const out = { at: new Date().toISOString(), files: [], summary: {} };
for (const s of SYMS) {
  const r = await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&symbol=${s}&page=1&size=50`, NSEH);
  let a = []; try { a = JSON.parse(r.t).data || []; } catch {}
  for (const p of PERIODS) {
    const rec = a.find((x) => (x.qe_Date || '').includes(p.slice(0, 7)) || x.qe_Date === p) ?? null; if (!rec?.xbrl) { out.files.push({ s, p, found: false }); continue; }
    const x = await get(rec.xbrl); const t = x.t;
    const ctx = {}; for (const m of t.matchAll(/<(?:\w+:)?context\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?context>/g)) ctx[m[1]] = /instant/.test(m[2]) ? 'instant' : 'duration';
    const tags = {};
    for (const m of t.matchAll(/<(?:[\w.-]+:)?(\w+)\s+([^>]*?)contextRef="([^"]+)"[^>]*>\s*([^<\s][^<]*?)\s*<\//g)) { const [, tag, , c, v] = m; if (!RX.test(tag) || ctx[c] !== 'instant') continue; (tags[tag] ??= []).length < 2 && tags[tag].push(v.slice(0, 18)); }
    out.files.push({ s, p, found: true, qe: rec.qe_Date, consolidated: rec.consolidated, status: x.status, bytes: t.length, nTags: Object.keys(tags).length, tags });
    for (const k of Object.keys(tags)) { const o = ((out.summary[p] ??= {})[k] ??= 0); out.summary[p][k] = o + 1; }
    await new Promise((r2) => setTimeout(r2, 350));
  }
}
writeFileSync('data/probe-bs-tags.json', JSON.stringify(out) + '\n');
for (const p of PERIODS) { const n = out.files.filter((f) => f.p === p && f.found).length; console.log(p, 'files', n); const s = out.summary[p] ?? {}; console.log(Object.entries(s).sort((x, y) => y[1] - x[1]).slice(0, 45).map(([k, v]) => `${k}:${v}`).join(' ')); }
