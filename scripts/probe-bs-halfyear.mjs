// One-off probe (Batch B window, 14 Nov 2026): the old quarterly XBRL files before Oct 2022 carry no balance sheet. Does NSE's half-yearly results list (period=Half-Yearly) carry an XBRL for Sep 2021 and Mar 2022 with the balance sheet?
// Writes data/probe-bs-halfyear.json. Public data only. Read-only; changes no rule.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const get = async (url, h) => { try { const r = await fetch(url, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(60000) }); return { status: r.status, t: await r.text() }; } catch { return { status: 0, t: '' }; } };
const arr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : j.data || []; } catch { return []; } };
const isoDate = (q) => { const d = new Date(`${q} UTC`); return Number.isNaN(d.getTime()) ? String(q) : d.toISOString().slice(0, 10); };
const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const RX = /^Assets$|^Equity$|CurrentInvestments|CurrentAssets|Borrowings|CashAndCashEquivalents|Lease/i;
const out = { at: new Date().toISOString(), periods: {} };
for (const p of ['2021-09-30', '2022-03-31']) {
  const d0 = new Date(p + 'T00:00:00Z'), seen = new Set(), rows = [], kinds = {};
  for (let off = 1; off < 125; off += 30) {
    const a = new Date(d0.getTime() + off * 864e5), b = new Date(d0.getTime() + Math.min(off + 29, 125) * 864e5);
    for (const period of ['Half-Yearly', 'Annual']) {
      const list = arr((await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&period=${period}&from_date=${fmt(a)}&to_date=${fmt(b)}`, NSEH)).t);
      for (const r of list) { kinds[period] = (kinds[period] || 0) + 1; if (!/^https?:/.test(r.xbrl || '') || isoDate(r.toDate) !== p || seen.has(r.xbrl)) continue; seen.add(r.xbrl); rows.push({ symbol: r.symbol, xbrl: r.xbrl, period, consolidated: r.consolidated, keys: Object.keys(r).join(',') }); }
      await new Promise((r2) => setTimeout(r2, 500));
    }
  }
  const sample = []; for (const r of rows.slice(0, 25)) { const x = await get(r.xbrl); const tags = {}; for (const m of x.t.matchAll(/<(?:[\w.-]+:)?(\w+)\s+[^>]*contextRef="[^"]+"[^>]*>\s*([^<\s][^<]*?)\s*<\//g)) if (RX.test(m[1]) && !(m[1] in tags)) tags[m[1]] = m[2].slice(0, 16); sample.push({ symbol: r.symbol, period: r.period, bytes: x.t.length, status: x.status, nTags: Object.keys(tags).length, tags }); await new Promise((r2) => setTimeout(r2, 350)); }
  out.periods[p] = { listed: rows.length, kinds, byPeriod: rows.reduce((o, r) => ((o[r.period] = (o[r.period] || 0) + 1), o), {}), keys: rows[0]?.keys ?? null, withBalanceSheet: sample.filter((s) => s.tags.Assets != null || s.tags.Equity != null).length, sampled: sample.length, sample: sample.slice(0, 6) };
}
writeFileSync('data/probe-bs-halfyear.json', JSON.stringify(out) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.periods).map(([k, v]) => [k, { listed: v.listed, kinds: v.kinds, byPeriod: v.byPeriod, withBalanceSheet: v.withBalanceSheet, sampled: v.sampled }]))));
