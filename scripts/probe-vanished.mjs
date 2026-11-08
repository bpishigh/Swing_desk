// One-off probe, round 6 (package I-2): do a vanished symbol's own NSE announcements say why it ended (merger, amalgamation, delisting)? Writes data/probe-vanished.json. Public data only.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sample = JSON.parse(readFileSync('data/india/.struct-sample.json', 'utf8'));
const RX = { amalgamation: /amalgamat|merger|merge with|scheme of arrangement/i, delisting: /delist/i, liquidation: /liquidat|insolvency|ibc|resolution plan|nclt/i, symbolChange: /change in (symbol|name)|name change/i };
const out = { at: new Date().toISOString(), rows: [] };
for (const x of sample) {
  let r; try { r = await fetch(`https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(x.s)}`, { headers: UA, signal: AbortSignal.timeout(45000) }); } catch { out.rows.push({ ...x, status: 0 }); continue; }
  const t = await r.text(); let a = []; try { const j = JSON.parse(t); a = Array.isArray(j) ? j : j.data || []; } catch {}
  const row = { ...x, status: r.status, n: a.length, hits: {} };
  for (const [k, rx] of Object.entries(RX)) { const m = a.filter((q) => rx.test(`${q.desc || ''} ${q.attchmntText || ''}`)); row.hits[k] = m.length; if (m.length && !row.sample) row.sample = (m[0].desc || '').slice(0, 50) + ' | ' + (m[0].attchmntText || '').slice(0, 130).replace(/,/g, ';'); }
  const dates = a.map((q) => q.an_dt).filter(Boolean); row.lastAnn = dates.length ? dates.sort((p, q) => new Date(p) - new Date(q)).slice(-1)[0] : null;
  out.rows.push(row); await sleep(350);
}
writeFileSync('data/probe-vanished.json', JSON.stringify(out, null, 1) + '\n');
const c = (f) => out.rows.filter(f).length;
console.log('rows', out.rows.length, 'with announcements', c((r) => r.n > 0), 'amalgamation hits', c((r) => r.hits?.amalgamation), 'delisting hits', c((r) => r.hits?.delisting), 'liquidation hits', c((r) => r.hits?.liquidation));
