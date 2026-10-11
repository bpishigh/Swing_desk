// One-off: does NSE's announcements / corporate-actions feed answer, and does it carry ETF unit splits? Uses a stock as control.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const base = 'https://www.nseindia.com';
const w = await fetch(base, { headers: H });
let cookie = (w.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const w2 = await fetch(base + '/companies-listing/corporate-filings-announcements', { headers: { ...H, cookie } });
cookie += '; ' + (w2.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const HA = { ...H, cookie, referer: base + '/companies-listing/corporate-filings-announcements', accept: 'application/json, text/plain, */*' };
const out = { ts: new Date().toISOString(), tests: [] };
const t = async (k, path) => {
  let r, text = '';
  try { r = await fetch(base + path, { headers: HA }); text = await r.text(); } catch (e) { out.tests.push({ k, error: String(e) }); return; }
  let n = null, items = null;
  try { const j = JSON.parse(text); const a = Array.isArray(j) ? j : j.data; n = Array.isArray(a) ? a.length : null; items = Array.isArray(a) ? a.slice(0, 3) : j; } catch {}
  out.tests.push({ k, status: r.status, bytes: text.length, n, sample: items ?? text.slice(0, 200) });
};
const wide = '&from_date=01-02-2026&to_date=31-10-2026';
await t('ctl_actions_RELIANCE', '/api/corporates-corporateActions?index=equities&symbol=RELIANCE');
await t('ctl_actions_window', '/api/corporates-corporateActions?index=equities&from_date=01-09-2026&to_date=31-10-2026');
await t('ctl_ann_RELIANCE', '/api/corporate-announcements?index=equities&symbol=RELIANCE');
for (const s of ['GROWWGOLD', 'QNIFTY', 'GOLDADD']) {
  await t(`ann_${s}`, `/api/corporate-announcements?index=equities&symbol=${s}${wide}`);
  await t(`ann_${s}_nodates`, `/api/corporate-announcements?index=equities&symbol=${s}`);
  await t(`actions_${s}`, `/api/corporates-corporateActions?index=equities&symbol=${s}${wide}`);
  await t(`ann_${s}_sme`, `/api/corporate-announcements?index=sme&symbol=${s}${wide}`);
}
await t('ann_window', '/api/corporate-announcements?index=equities&from_date=07-08-2026&to_date=31-08-2026&subject=Split');
await t('circulars', '/api/circulars?from_date=01-02-2026&to_date=31-10-2026&dept=&subject=ETF');
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/etf-probe3.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.tests.map((x) => [x.k, x.status ?? x.error, x.bytes, x.n].join(' ')).join('\n'));
