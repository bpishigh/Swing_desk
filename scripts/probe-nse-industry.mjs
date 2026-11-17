// One-off probe: can the runner read NSE's per-stock industry (quote-equity industryInfo) and the Nifty Total Market list? Writes data/india/probe-industry.json.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const out = { at: new Date().toISOString() };
try { const r = await fetch('https://archives.nseindia.com/content/indices/ind_niftymicrocap250_list.csv', { headers: UA }); out.micro = { status: r.status, head: (await r.text()).split('\n').slice(0, 3) }; } catch (e) { out.micro = { error: e.message }; }
try {
  const h = await fetch('https://www.nseindia.com/', { headers: UA }); const ck = (h.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  out.home = h.status; out.quotes = {};
  for (const s of ['GRAVITA', 'KPITTECH', 'RPOWER', 'AARTIIND', 'SHAKTIPUMP']) {
    const r = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${s}`, { headers: { ...UA, cookie: ck, referer: 'https://www.nseindia.com/' } });
    const t = await r.text(); let ii = null; try { ii = JSON.parse(t).industryInfo ?? null; } catch {}
    out.quotes[s] = { status: r.status, industryInfo: ii };
  }
} catch (e) { out.quotesError = e.message; }
writeFileSync('data/india/probe-industry.json', JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out));
