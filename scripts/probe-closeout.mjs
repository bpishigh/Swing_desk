// One-off probe, round 4 (package I-2 close-out): period of the integrated-filing facts and EPS tags; pre-2020 results XBRL formats; FINRA short-interest history; SEC CIK-name file for delisted filers. Writes data/probe-closeout.json. Public data only.
import { writeFileSync } from 'node:fs';
const BR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SEC_UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com';
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url, h = {}, ua = BR, init = {}) => { try { const r = await fetch(url, { headers: { 'user-agent': ua, ...h }, signal: AbortSignal.timeout(60000), ...init }); return { status: r.status, t: await r.text(), len: r.headers.get('content-length'), range: r.headers.get('content-range') }; } catch (e) { return { status: 0, t: '' }; } };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const yearOf = (v) => { const m = String(v || '').match(/(\d{4})/); return m ? +m[1] : null; };
const out = { at: new Date().toISOString(), oneD: [], old: [], finra: {}, sec: {} };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
// a) contexts and EPS tags in the integrated XBRL (Ind AS and banking).
for (const s of ['RELIANCE', 'HDFCBANK']) {
  const r = JSON.parse((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&symbol=${s}&page=1&size=50`, NSEH)).t).data;
  const rec = r.filter((x) => /^Consolidated/i.test(x.consolidated)).sort((a, b) => new Date(b.broadcast_Date) - new Date(a.broadcast_Date))[0] || r[0];
  const x = (await get(rec.xbrl)).t;
  const ctx = [...x.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)].map((m) => ({ id: m[1], period: (m[2].match(/<xbrli:(?:startDate|instant)>([^<]+)</g) || []).map((q) => q.replace(/<[^>]+>/g, '')).join(' to '), dim: /explicitMember/.test(m[2]) })).filter((c) => !c.dim).slice(0, 8);
  const names = [...new Set([...x.matchAll(/<in-capmkt:(\w+)[\s>]/g)].map((m) => m[1]))];
  const eps = names.filter((n) => /EarningsLossPerShare|EarningsPerShare|PerShare/.test(n));
  const vals = eps.slice(0, 6).map((n) => { const m = x.match(new RegExp(`<in-capmkt:${n}\\s+([^>]*)>\\s*([^<]+)<`)); return { n, ctx: m?.[1].match(/contextRef="([^"]+)"/)?.[1], v: m?.[2] }; });
  const used = [...new Set([...x.matchAll(/contextRef="([^"]+)"/g)].map((m) => m[1]))].slice(0, 12);
  out.oneD.push({ s, qe: rec.qe_Date, consolidated: rec.consolidated, contexts: ctx, contextsUsed: used, epsTags: eps.slice(0, 8), epsValues: vals, revenueLike: names.filter((n) => /Revenue|Income$|TotalIncome|InterestEarned/.test(n)).slice(0, 8) });
  await sleep(400);
}
// b) pre-2020 results XBRL: oldest, ~2016, ~2019 records for four stocks.
for (const s of ['RELIANCE', 'TCS', 'HDFCBANK', 'KPITTECH']) {
  const a = JSON.parse((await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=${s}&period=Quarterly`, NSEH)).t); await sleep(300);
  const arr = (Array.isArray(a) ? a : a.data || []).filter((r) => r.xbrl && r.xbrl !== '-');
  for (const y of [2010, 2013, 2016, 2019, 2021]) {
    const rec = arr.filter((r) => yearOf(r.toDate) === y)[0]; if (!rec) { out.old.push({ s, y, none: true }); continue; }
    const x = await get(rec.xbrl); await sleep(300);
    const names = [...new Set([...x.t.matchAll(/<([\w.-]+:[\w.-]+)[\s>]/g)].map((m) => m[1]))];
    out.old.push({ s, y, toDate: rec.toDate, consolidated: rec.consolidated, status: x.status, bytes: x.t.length, head: x.status === 200 ? x.t.slice(0, 120).replace(/\s+/g, ' ') : x.t.slice(0, 80), prefixes: [...new Set(names.map((n) => n.split(':')[0]))].slice(0, 6), fin: names.filter((n) => /Revenue|SalesOrTurnover|Turnover|ProfitLoss|ProfitBeforeTax|EarningsPerShare|NetProfit|IncomeOnInvest|InterestEarned/i.test(n)).slice(0, 8) });
  }
}
// c) FINRA: boundary in 2017 and the API.
for (const d of ['20170630', '20171229', '20170331', '20161230', '20150630', '20141231', '20100630']) { const r = await get(`https://cdn.finra.org/equity/otcmarket/biweekly/shrt${d}.csv`, { range: 'bytes=0-120' }); out.finra[d] = r.status; await sleep(150); }
for (const d of ['2015-12-31', '2012-06-29']) {
  const r = await get('https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest', { 'content-type': 'application/json', accept: 'application/json' }, BR, { method: 'POST', body: JSON.stringify({ limit: 2, compareFilters: [{ compareType: 'EQUAL', fieldName: 'settlementDate', fieldValue: d }] }) });
  out.finra['api_' + d] = { status: r.status, head: r.t.slice(0, 220).replace(/\s+/g, ' ') }; await sleep(300);
}
// d) SEC name-to-CIK file (all filers ever), size and a lookup.
const hd = await get('https://www.sec.gov/Archives/edgar/cik-lookup-data.txt', { range: 'bytes=0-400' }, SEC_UA); out.sec.cikLookup = { status: hd.status, range: hd.range, head: hd.t.slice(0, 160).replace(/\s+/g, ' ') };
const ex = await get('https://www.sec.gov/files/company_tickers_exchange.json', {}, SEC_UA); out.sec.tickersExchange = { status: ex.status, bytes: ex.t.length };
writeFileSync('data/probe-closeout.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ finra: out.finra, sec: out.sec }));
