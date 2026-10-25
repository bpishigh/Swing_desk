// One-off probe (scope K3), round 2: NSE's shareholding filing lists an XBRL file per quarter; does it carry the promoter pledge figures, and can it be read? Writes data/probe-pledge.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'accept-language': 'en-IN,en;q=0.9' };
const get = async (url, h = {}) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(40000), redirect: 'follow' }); const t = await r.text(); return { status: r.status, t }; } catch (e) { return { status: 0, err: String(e).slice(0, 120), t: '' }; } };
const out = { at: new Date().toISOString(), rows: [] };
const nse = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
for (const s of ['ADANIENT', 'RPOWER', 'RELIANCE', 'JPPOWER']) {
  const m = await get(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${s}`, nse);
  let rec = null; try { rec = JSON.parse(m.t)[0]; } catch {}
  const row = { s, masterStatus: m.status, keys: rec ? Object.keys(rec) : null, date: rec?.date, promoter: rec?.pr_and_prgrp, xbrl: rec?.xbrl ?? null };
  if (rec?.xbrl) {
    const x = await get(rec.xbrl, { referer: 'https://www.nseindia.com/' });
    row.x = { status: x.status, bytes: x.t.length, head: x.t.slice(0, 200), pledgeTags: [...x.t.matchAll(/<[^>]*(?:ledge|ncumber)[^>]*>[^<]{0,80}/gi)].map((q) => q[0].slice(0, 200)).slice(0, 25) };
  }
  for (const ep of [`corporate-pledgedata?index=equities&symbol=${s}&from_date=01-01-2025&to_date=25-10-2026`, `corporate-pledgedata?index=equities`]) { const p = await get('https://www.nseindia.com/api/' + ep, nse); (row.pledge ??= []).push({ ep: ep.slice(0, 60), status: p.status, bytes: p.t.length, head: p.t.slice(0, 300) }); }
  out.rows.push(row); await new Promise((r) => setTimeout(r, 1500));
}
writeFileSync('data/probe-pledge.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.rows.map((o) => `${o.s} xbrl=${o.x?.status} tags=${o.x?.pledgeTags?.length}`).join('\n'));
