// One-off timing probe for the filings backfill: lists one quarter, then fetches 300 filings at 6 parallel with the backfill's pacing and prints seconds per page and per filing. Commits nothing.
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { ...UA, referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u, h = UA) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(90000) }); if (r.status === 200) return { status: 200, t: await r.text() }; if (r.status === 404) return { status: 404, t: '' }; } catch {} await sleep(1500 * (k + 1)); } return { status: 0, t: '' }; };
const arr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : j.data || []; } catch { return []; } };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
let t0 = Date.now(), all = [], pages = 0;
for (let p = 1; p <= 30; p++) { const a = arr((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&period_ended=31-Mar-2026&page=${p}&size=500`, NSEH)).t); if (!a.length) break; all = all.concat(a); pages++; await sleep(300); }
console.log(`list: ${all.length} records, ${pages} pages, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const recs = all.filter((_, i) => i % Math.floor(all.length / 300) === 0).slice(0, 300); t0 = Date.now(); let i = 0, ok = 0, bad = 0, bytes = 0;
const worker = async () => { while (i < recs.length) { const r = await get(recs[i++].xbrl); if (r.status === 200) { ok++; bytes += r.t.length; } else bad++; await sleep(60); } };
await Promise.all(Array.from({ length: 6 }, worker));
const s = (Date.now() - t0) / 1000; console.log(`fetch: ${ok} ok, ${bad} failed, ${s.toFixed(1)} s, ${(s / recs.length).toFixed(3)} s per filing, avg ${(bytes / Math.max(ok, 1) / 1024).toFixed(0)} KB`);
