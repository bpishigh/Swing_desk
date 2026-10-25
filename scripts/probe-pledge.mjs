// One-off probe (scope K3), round 3: the numeric pledge elements of NSE's shareholding XBRL, and the contexts they sit in. Writes data/probe-pledge.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (url, h = {}) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(40000) }); return { status: r.status, t: await r.text() }; } catch (e) { return { status: 0, t: '' }; } };
const out = { at: new Date().toISOString(), rows: [] };
for (const s of ['ADANIENT', 'JPPOWER']) {
  const m = await get(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${s}`, { referer: 'https://www.nseindia.com/', accept: 'application/json' });
  const rec = JSON.parse(m.t)[0]; const x = (await get(rec.xbrl)).t;
  const tags = [...x.matchAll(/<in-bse-shp:(\w*(?:ledge|ncumber)\w*)\s+([^>]*)>\s*([^<\s][^<]*?)\s*<\//g)].filter((q) => /^-?[\d.]+$/.test(q[3])).map((q) => ({ tag: q[1], attrs: q[2].replace(/\s+/g, ' ').slice(0, 120), v: q[3] }));
  const ctx = [...x.matchAll(/<xbrli:context id="([^"]+)"[\s\S]*?<\/xbrli:context>/g)].filter((q) => tags.some((t) => t.attrs.includes('"' + q[1] + '"'))).map((q) => ({ id: q[1], body: q[0].replace(/\s+/g, ' ').slice(0, 400) }));
  const shp = [...x.matchAll(/<in-bse-shp:(ShareholdingAsAPercentageOfTotalNumberOfShares|NumberOfFullyPaidUpEquityShares\w*|TotalNumberOfShares\w*)\s+([^>]*)>\s*([\d.]+)/g)].map((q) => ({ tag: q[1], attrs: q[2].slice(0, 90), v: q[3] })).slice(0, 14);
  out.rows.push({ s, date: rec.date, n: tags.length, tags: tags.slice(0, 40), ctx: ctx.slice(0, 8), shp });
}
writeFileSync('data/probe-pledge.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.rows.map((r) => r.s + ' ' + r.n).join('\n'));
