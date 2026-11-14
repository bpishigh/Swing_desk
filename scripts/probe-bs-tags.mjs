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
const arr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : j.data || []; } catch { return []; } };
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], dm = (p) => `${p.slice(8, 10)}-${MON[Number(p.slice(5, 7)) - 1]}-${p.slice(0, 4)}`;
const isoDate = (q) => { const d = new Date(`${q} UTC`); return Number.isNaN(d.getTime()) ? String(q) : d.toISOString().slice(0, 10); };
const listings = {}; out.lists = {};
for (const p of PERIODS) {
  let all = [];
  for (let pg = 1; pg <= 12; pg++) { const a = arr((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&period_ended=${dm(p)}&page=${pg}&size=500`, NSEH)).t); if (!a.length) break; all = all.concat(a); await new Promise((r) => setTimeout(r, 300)); }
  if (all.length === 0) {
    const seen = new Set(), d0 = new Date(p + 'T00:00:00Z'), fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
    for (let off = 1; off < 125; off += 30) { const a = new Date(d0.getTime() + off * 864e5), b = new Date(d0.getTime() + Math.min(off + 29, 125) * 864e5);
      for (const r of arr((await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=${fmt(a)}&to_date=${fmt(b)}`, NSEH)).t)) { if (!/^https?:/.test(r.xbrl || '') || isoDate(r.toDate) !== p || seen.has(r.xbrl)) continue; if (/^cumulative$/i.test(r.cumulative || '')) continue; seen.add(r.xbrl); all.push({ symbol: r.symbol, xbrl: r.xbrl, consolidated: r.consolidated }); }
      await new Promise((r) => setTimeout(r, 500)); }
  }
  listings[p] = all; out.lists[p] = all.length;
}
for (const p of PERIODS) for (const s of SYMS) {
  const cands = (listings[p] || []).filter((x) => x.symbol === s && x.xbrl), rec = cands.find((x) => /^Y/i.test(String(x.consolidated)) || /Consolidated/i.test(String(x.consolidated))) ?? cands[0] ?? null;
  if (!rec?.xbrl) { out.files.push({ s, p, found: false }); continue; }
  const x = await get(rec.xbrl); const t = x.t;
  const ctx = {}; for (const m of t.matchAll(/<(?:\w+:)?context\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?context>/g)) ctx[m[1]] = /instant/.test(m[2]) ? 'instant' : 'duration';
  const tags = {};
  for (const m of t.matchAll(/<(?:[\w.-]+:)?(\w+)\s+([^>]*?)contextRef="([^"]+)"[^>]*>\s*([^<\s][^<]*?)\s*<\//g)) { const [, tag, , c, v] = m; if (!RX.test(tag) || ctx[c] !== 'instant') continue; const a = (tags[tag] ??= []); if (a.length < 2) a.push(v.slice(0, 18)); }
  out.files.push({ s, p, found: true, consolidated: rec.consolidated, status: x.status, bytes: t.length, nTags: Object.keys(tags).length, tags });
  for (const k of Object.keys(tags)) { const o = (out.summary[p] ??= {}); o[k] = (o[k] || 0) + 1; }
  await new Promise((r2) => setTimeout(r2, 350));
}
writeFileSync('data/probe-bs-tags.json', JSON.stringify(out) + '\n');
for (const p of PERIODS) { const n = out.files.filter((f) => f.p === p && f.found).length; console.log(p, 'files', n); const s = out.summary[p] ?? {}; console.log(Object.entries(s).sort((x, y) => y[1] - x[1]).slice(0, 45).map(([k, v]) => `${k}:${v}`).join(' ')); }
