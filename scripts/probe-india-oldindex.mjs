// One-off probe (backtester data): do NSE's daily index close files (ind_close_all_DDMMYYYY.csv) exist before Nov 2015, and under which index names?
// NSE renamed CNX indices to Nifty in Nov 2015; the back-fill keeps only the new names, so older files may have been read and thrown away. Output only: data/probe-india-oldindex.json
import { writeFileSync } from 'node:fs';
const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: '*/*', referer: 'https://www.nseindia.com/' };
const DATES = ['2010-06-15', '2011-03-16', '2012-06-14', '2013-09-18', '2014-03-12', '2014-12-10', '2015-06-17', '2015-11-04', '2015-11-09'];
const res = [];
for (const iso of DATES) {
  const name = `ind_close_all_${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}.csv`, row = { date: iso };
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    try {
      const r = await fetch(`https://${host}/content/indices/${name}`, { headers: H }), t = await r.text();
      const lines = t.split(/\r?\n/).filter(Boolean), html = /^\s*<(!doctype|html)/i.test(t);
      row[host.split('.')[0]] = { status: r.status, html, rows: html ? 0 : lines.length - 1, header: html ? undefined : lines[0].slice(0, 160).replace(/,/g, ' '), names: html ? undefined : lines.slice(1).map((l) => l.split(',')[0]).filter((n) => /500|nifty 50|cnx|s&p/i.test(n)).slice(0, 12).join(' | ') };
    } catch (e) { row[host.split('.')[0]] = { error: String(e.message ?? e) }; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  res.push(row);
}
writeFileSync('data/probe-india-oldindex.json', JSON.stringify({ at: new Date().toISOString(), results: res }, null, 1) + '\n');
console.log(JSON.stringify(res).slice(0, 1800));
