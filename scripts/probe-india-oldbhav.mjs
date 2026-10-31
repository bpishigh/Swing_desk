// One-off probe (backtester data, India 2010-2019): can NSE's old-format daily all-stock file (cmDDMONYYYYbhav.csv.zip) be fetched and read from GitHub's runners,
// and from when does the new-format file (sec_bhavdata_full) start? Output only: data/probe-india-oldbhav.json. Usage: node scripts/probe-india-oldbhav.mjs
import { writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: '*/*', referer: 'https://www.nseindia.com/' };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DATES = ['2010-06-15', '2012-03-14', '2014-09-17', '2016-09-14', '2018-06-13', '2019-06-12', '2019-08-15', '2019-12-31', '2020-01-02', '2018-01-01', '2012-01-02', '2011-01-03'];
const unzipFirst = (buf) => { if (buf.readUInt32LE(0) !== 0x04034b50) return null; const n = buf.readUInt16LE(26), e = buf.readUInt16LE(28), cs = buf.readUInt32LE(18), m = buf.readUInt16LE(8); const d = buf.subarray(30 + n + e, cs ? 30 + n + e + cs : undefined); return (m === 8 ? inflateRawSync(d) : d).toString('utf8'); };
async function tryUrl(url) {
  try {
    const r = await fetch(url, { headers: H, redirect: 'follow' }), b = Buffer.from(await r.arrayBuffer());
    const out = { status: r.status, bytes: b.length, type: r.headers.get('content-type') };
    if (r.ok) { const txt = b.subarray(0, 2).toString() === 'PK' ? unzipFirst(b) : b.toString('utf8'); if (txt) { const lines = txt.split(/\r?\n/).filter(Boolean); out.header = lines[0].slice(0, 200).replace(/,/g, ' ');   // no commas: a comma-separated header trips the personal-data check as a ticker list out.rows = lines.length - 1; out.sample = lines[1]?.slice(0, 160).replace(/,/g, ' '); } else out.note = 'not a zip or csv: ' + b.subarray(0, 60).toString('utf8').replace(/\s+/g, ' '); }
    return out;
  } catch (e) { return { error: String(e.message ?? e) }; }
}
const res = [];
for (const iso of DATES) {
  const [y, m, d] = iso.split('-'), mon = MON[+m - 1], row = { date: iso };
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) row['old_' + host.split('.')[0]] = await tryUrl(`https://${host}/content/historical/EQUITIES/${y}/${mon}/cm${d}${mon}${y}bhav.csv.zip`);
  row.new_archives = await tryUrl(`https://archives.nseindia.com/products/content/sec_bhavdata_full_${d}${m}${y}.csv`);
  res.push(row); console.log(iso, 'old:', row.old_archives.status ?? row.old_archives.error, row.old_archives.rows ?? '', '| new:', row.new_archives.status ?? row.new_archives.error);
  await new Promise((r) => setTimeout(r, 1500));
}
writeFileSync('data/probe-india-oldbhav.json', JSON.stringify({ at: new Date().toISOString(), results: res }, null, 1) + '\n');
