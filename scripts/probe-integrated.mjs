// One-off probe, round 3 (package I-2): NSE's integrated-filing results endpoint (results from Feb 2025), and announcements as a results-date fallback. Writes data/probe-integrated.json. Public data only; no rule change.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url, h = NSEH) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(45000) }); return { status: r.status, t: await r.text() }; } catch (e) { return { status: 0, t: '', err: String(e.message || e).slice(0, 60) }; } };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const toDate = (v) => { if (typeof v !== 'string') return null; const m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/); return m && MON[m[2].toUpperCase()] != null ? new Date(Date.UTC(+m[3], MON[m[2].toUpperCase()], +m[1])) : null; };
const iso = (d) => d.toISOString().slice(0, 10);
const arrOf = (t) => { try { const j = JSON.parse(t); return { j, arr: Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.rows) ? j.rows : null }; } catch { return { j: null, arr: null }; } };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
const base = `https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}`;
const out = { at: new Date().toISOString(), shape: {}, symbols: {}, byPeriod: {}, announcements: {} };
// 1. Shape and paging behaviour.
const t1 = await get(`${base}&page=1&size=20`); const p1 = arrOf(t1.t);
out.shape = { status: t1.status, topKeys: p1.j && !Array.isArray(p1.j) ? Object.keys(p1.j).slice(0, 10) : 'array', n: p1.arr?.length, keys: p1.arr?.[0] ? Object.keys(p1.arr[0]) : null, sample: p1.arr?.[0] ? JSON.stringify(p1.arr[0]).slice(0, 700) : t1.t.slice(0, 200), meta: p1.j && !Array.isArray(p1.j) ? JSON.stringify(Object.fromEntries(Object.entries(p1.j).filter(([k]) => k !== 'data' && k !== 'rows'))).slice(0, 300) : null };
for (const size of [200, 1000, 5000]) { const r = await get(`${base}&page=1&size=${size}`); await sleep(400); out.shape[`size${size}`] = { status: r.status, n: arrOf(r.t).arr?.length ?? null }; }
// 2. Per-symbol history (sample from the round-2 list plus large names).
const cov = JSON.parse(readFileSync('data/probe-filings-coverage.json', 'utf8')).india.sample;
const syms = ['RELIANCE', 'TCS', 'ADANIENT', 'KPITTECH', ...cov.listed.slice(0, 26), ...cov.absentNow.slice(0, 3)];
const pe = (r) => r.qe_Date || r.period_ended || r.periodEnded || r.quarterEnded || r.toDate || r.qtr_end || null;
for (const s of syms) {
  const o = { n: 0, pages: 0 }; let all = [];
  for (let page = 1; page <= 6; page++) { const r = await get(`${base}&symbol=${encodeURIComponent(s)}&page=${page}&size=50`); await sleep(300); o.status = r.status; const a = arrOf(r.t).arr || []; if (!a.length) break; all = all.concat(a); o.pages = page; if (a.length < 50) break; }
  o.n = all.length;
  if (all.length) {
    const keys = Object.keys(all[0]); o.keys = o.keys || keys;
    const dateKeys = keys.filter((k) => all.some((r) => toDate(r[k]))); o.dates = {}; for (const k of dateKeys) { const ds = all.map((r) => toDate(r[k])).filter(Boolean).sort((a, b) => a - b); o.dates[k] = [iso(ds[0]), iso(ds[ds.length - 1])]; }
    const linkKey = keys.find((k) => /xbrl/i.test(k) && all.some((r) => typeof r[k] === 'string' && /^http/.test(r[k]))); o.linkKey = linkKey || null;
    if (linkKey && !out.xbrlChecked) {
      out.xbrlChecked = [];
      for (const r of [all[0], all[all.length - 1]]) { const x = await get(r[linkKey], UA); await sleep(300); const tags = new Set([...x.t.matchAll(/<[\w-]+:(\w+)[\s>]/g)].map((m) => m[1])); out.xbrlChecked.push({ status: x.status, bytes: x.t.length, nTags: tags.size, hit: [...tags].filter((t) => /RevenueFromOperations|ProfitLossForPeriod|ProfitBeforeTax|BasicEarnings|TotalIncome/.test(t)).slice(0, 6), head: x.status !== 200 ? x.t.slice(0, 100) : undefined }); }
    }
    o.sample = JSON.stringify(all[0]).slice(0, 400);
  }
  out.symbols[s] = o;
}
// 3. Market-wide by period end: how many filings and symbols per quarter, paging up to 40 pages of 500.
for (const pend of ['31-Dec-2024', '31-Mar-2025', '30-Jun-2025', '30-Sep-2025', '31-Dec-2025', '31-Mar-2026', '30-Jun-2026', '30-Sep-2026']) {
  let all = [], status = 0, pages = 0;
  for (let page = 1; page <= 40; page++) { const r = await get(`${base}&period_ended=${pend}&page=${page}&size=500`); await sleep(350); status = r.status; const a = arrOf(r.t).arr || []; if (!a.length) break; all = all.concat(a); pages = page; if (a.length < 500) break; }
  const symKey = all[0] ? Object.keys(all[0]).find((k) => /^symbol$/i.test(k)) : null;
  out.byPeriod[pend] = { status, pages, n: all.length, symbols: symKey ? new Set(all.map((r) => r[symKey])).size : null };
}
// 4. Announcements as a results-date fallback: results-like subjects in 2025 to 2026 for the sample.
const rx = /financial result|outcome of board meeting|unaudited|audited/i;
for (const s of syms.slice(0, 20)) {
  const r = await get(`https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(s)}`); await sleep(300);
  const a = arrOf(r.t).arr || []; if (a[0] && !out.announcements._keys) out.announcements._keys = Object.keys(a[0]);
  const hits = a.filter((x) => rx.test(`${x.desc || ''} ${x.attchmntText || ''}`)).map((x) => ({ d: x.an_dt || x.exchdisstime, desc: (x.desc || '').slice(0, 40) })).filter((x) => x.d).sort((x, y) => (toDate(x.d) - toDate(y.d)));
  const rec = hits.filter((x) => toDate(x.d) >= new Date(Date.UTC(2025, 1, 1)));
  out.announcements[s] = { status: r.status, n: a.length, resultsLike: hits.length, since2025: rec.length, latest: hits.length ? hits[hits.length - 1] : null, descSample: [...new Set(hits.slice(-12).map((h) => h.desc))].slice(0, 4) };
}
writeFileSync('data/probe-integrated.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ shape: { status: out.shape.status, n: out.shape.n, keys: out.shape.keys }, periods: out.byPeriod }));
