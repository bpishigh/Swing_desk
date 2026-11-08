// One-off probe, round 5 (package I-2): (a) do integrated and older results XBRL files carry comparative periods; (b) NSE symbol-change and name-change lists for merger and rename detection. Writes data/probe-structure.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url, h = UA) => { try { const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(60000) }); return { status: r.status, t: await r.text() }; } catch (e) { return { status: 0, t: '' }; } };
const out = { at: new Date().toISOString(), comparatives: [], lists: {} };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
const analyse = (x) => {
  const ctx = {}; for (const m of x.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)) { const dim = /explicitMember|typedMember/.test(m[2]); const st = m[2].match(/<xbrli:startDate>([^<]+)</)?.[1], en = m[2].match(/<xbrli:endDate>([^<]+)</)?.[1], ins = m[2].match(/<xbrli:instant>([^<]+)</)?.[1]; ctx[m[1]] = { dim, p: ins ? ins : `${st}..${en}` }; }
  const nondimDur = Object.entries(ctx).filter(([, c]) => !c.dim && c.p.includes('..')).map(([id, c]) => `${id}:${c.p}`);
  const facts = (tag) => [...x.matchAll(new RegExp(`<in-[\\w-]+:${tag}\\s+([^>]*)>\\s*([^<]+)<`, 'g'))].map((m) => ({ ctx: m[1].match(/contextRef="([^"]+)"/)?.[1], v: m[2].trim() })).map((f) => ({ ...f, p: ctx[f.ctx]?.p, dim: ctx[f.ctx]?.dim }));
  const rev = facts('RevenueFromOperations'); const pat = facts('ProfitLossForPeriodFromContinuingOperations'); const bank = facts('ProfitLossForThePeriod'); const eps = facts('BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations').concat(facts('BasicEarningsPerShareAfterExtraordinaryItems'));
  return { nContexts: Object.keys(ctx).length, nonDimDurations: nondimDur.slice(0, 12), revenueFacts: rev.filter((f) => !f.dim).slice(0, 8), profitFacts: pat.concat(bank).filter((f) => !f.dim).slice(0, 8), epsFacts: eps.filter((f) => !f.dim).slice(0, 8) };
};
for (const s of ['RELIANCE', 'TCS', 'HDFCBANK', 'KPITTECH']) {
  const r = JSON.parse((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&symbol=${s}&page=1&size=50`, { ...UA, ...NSEH })).t).data;
  const cons = r.filter((x) => /^Consolidated/i.test(x.consolidated)); const pick = [cons[0] || r[0], cons[cons.length - 1] || r[r.length - 1]].filter(Boolean);
  for (const rec of pick) { const x = await get(rec.xbrl); out.comparatives.push({ s, format: 'integrated', qe: rec.qe_Date, consolidated: rec.consolidated, sub: rec.type_Sub, status: x.status, ...(x.status === 200 ? analyse(x.t) : {}) }); await sleep(400); }
  const old = JSON.parse((await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=${s}&period=Quarterly`, { ...UA, ...NSEH })).t); const oa = (Array.isArray(old) ? old : old.data || []).filter((q) => q.xbrl && q.xbrl !== '-' && /2020|2021|2022/.test(q.toDate));
  if (oa[0]) { const x = await get(oa[0].xbrl); out.comparatives.push({ s, format: 'older', qe: oa[0].toDate, consolidated: oa[0].consolidated, status: x.status, ...(x.status === 200 ? analyse(x.t) : {}) }); await sleep(400); }
}
// Symbol and name change lists (several candidate locations).
for (const [k, u] of [['symbolchange_nsearchives', 'https://nsearchives.nseindia.com/content/equities/symbolchange.csv'], ['symbolchange_archives', 'https://archives.nseindia.com/content/equities/symbolchange.csv'], ['namechange_nsearchives', 'https://nsearchives.nseindia.com/content/equities/namechange.csv'], ['namechange_archives', 'https://archives.nseindia.com/content/equities/namechange.csv'], ['eq_changes_api', 'https://www.nseindia.com/api/corporates-symbol-change?index=equities'], ['name_changes_api', 'https://www.nseindia.com/api/corporates-name-change?index=equities']]) {
  const h = k.endsWith('api') ? { ...UA, ...NSEH } : UA; const r = await get(u, h); const lines = r.t.split(/\r?\n/).filter(Boolean);
  out.lists[k] = { status: r.status, bytes: r.t.length, lines: lines.length, head: lines.slice(0, 3), tail: lines.slice(-3), isHtml: /<html/i.test(r.t.slice(0, 200)) }; await sleep(300);
}
writeFileSync('data/probe-structure.json', JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out.lists).map(([k, v]) => `${k}:${v.status}/${v.lines}${v.isHtml ? ' html' : ''}`).join(' '));
