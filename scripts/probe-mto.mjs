// One-off probe (15 Nov 2026): does NSE's older delivery file (MTO, archives/equities/mto/MTO_<date>.DAT) load for years before 2021? Writes data/probe-mto.json. Public data only; changes no rule.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.nseindia.com/', accept: '*/*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${d.getUTCFullYear()}`;
const out = { at: new Date().toISOString(), years: {} };
await fetch('https://www.nseindia.com/', { headers: UA }).catch(() => {});
for (const y of [2012, 2014, 2016, 2018, 2019, 2020, 2021]) {
  for (let off = 0, tried = 0; tried < 6; off++) {
    const d = new Date(Date.UTC(y, 5, 10 + off)); if ([0, 6].includes(d.getUTCDay())) continue; tried++;
    let status = 0, text = ''; try { const r = await fetch(`https://nsearchives.nseindia.com/archives/equities/mto/MTO_${fmt(d)}.DAT`, { headers: UA, signal: AbortSignal.timeout(60000) }); status = r.status; text = await r.text(); } catch {}
    await sleep(500);
    if (status === 200 && text.length > 1000) { const lines = text.split(/\r?\n/).filter(Boolean); out.years[y] = { date: fmt(d), status, lines: lines.length, head: lines.slice(0, 5).join(' | ').replaceAll(',', ' ; ').slice(0, 300) }; break; }
    out.years[y] = { date: fmt(d), status, lastTried: fmt(d) };
  }
}
writeFileSync('data/probe-mto.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.years).map(([y, v]) => [y, v.status + (v.lines ? ' rows ' + v.lines : '')]))));
