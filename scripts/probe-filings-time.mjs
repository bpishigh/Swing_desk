// One-off probe (Batch A): why some integrated-filing rows have no broadcast time. Prints the keys of rows with and without broadcast_Date for two quarters. Writes data/probe-filings-time.json.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { ...UA, referer: 'https://www.nseindia.com/', accept: 'application/json' };
const get = async (u, h) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(90000) }); if (r.status === 200) return await r.text(); } catch {} await new Promise((r) => setTimeout(r, 1500)); } return ''; };
const TYPE = encodeURIComponent('Integrated Filing- Financials'), out = {};
await get('https://www.nseindia.com/', UA);
for (const period of ['31-Mar-2026', '31-Mar-2025']) {
  let all = []; for (let p = 1; p <= 12; p++) { let a = []; try { const j = JSON.parse(await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&period_ended=${period}&page=${p}&size=500`, NSEH)); a = Array.isArray(j) ? j : j.data || []; } catch {} if (!a.length) break; all = all.concat(a); }
  const without = all.filter((r) => !r.broadcast_Date), withT = all.filter((r) => r.broadcast_Date);
  out[period] = { rows: all.length, withoutBroadcast: without.length, keys: Object.keys(all[0] || {}), sampleWithout: without.slice(0, 5), sampleWith: withT.slice(0, 2), typeSubCounts: Object.fromEntries([...new Set(all.map((r) => r.type_Sub))].map((k) => [k, all.filter((r) => r.type_Sub === k).length])) };
  console.log(period, all.length, without.length);
}
writeFileSync('data/probe-filings-time.json', JSON.stringify(out, null, 1));
