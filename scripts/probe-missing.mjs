// One-off: what does NSE return for a file that does not exist yet?
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/' };
const urls = {
  bhav_future_arch: 'https://archives.nseindia.com/products/content/sec_bhavdata_full_12102026.csv',
  bhav_holiday_arch: 'https://archives.nseindia.com/products/content/sec_bhavdata_full_02102025.csv',
  bhav_ok_arch: 'https://archives.nseindia.com/products/content/sec_bhavdata_full_09102026.csv',
  bhav_future: 'https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_12102026.csv',
  bhav_holiday: 'https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_02102025.csv',
  bhav_ok: 'https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_09102026.csv',
  idx_future_nse: 'https://nsearchives.nseindia.com/content/indices/ind_close_all_12102026.csv',
  idx_future_arch: 'https://archives.nseindia.com/content/indices/ind_close_all_12102026.csv',
  idx_ok_arch: 'https://archives.nseindia.com/content/indices/ind_close_all_09102026.csv',
};
const out = {};
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers: H, redirect: 'follow' }); const t = await r.text(); out[k] = { status: r.status, type: r.headers.get('content-type'), size: t.length, head: t.slice(0, 80).replace(/\s+/g, ' '), text: t.length < 30000 && /<html/i.test(t) ? t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 250) : undefined }; }
  catch (e) { out[k] = { error: String(e).slice(0, 100) }; }
}
writeFileSync('data/source-test/missing-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
