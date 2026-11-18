// Swing setups scoreboard (owner, 19 Nov 2026: "why are swing setup types not part of scoring; some have not fired yet - see why").
// Reads the swing paper ledgers (data/<market>/paper/book.json) and the nightly scans (data/<market>/scan/*.json); writes site/data/swing-setups.json.
// Per setup: nights seen ready, triggers by stream, fills, closes, win rate and mean R; per market: why stocks stayed on the watch list. Descriptive only; changes no rule.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const NAMES = { '1': 'Base breakout', '1ipo': 'IPO base', '2': '20 EMA pullback', '3': 'Earnings gap', '4': '50 SMA pullback' };
const out = { asOf: new Date().toISOString().slice(0, 10), markets: {} };
for (const m of ['india', 'us']) {
  const book = R(`data/${m}/paper/book.json`, { ledger: [] }), dir = `data/${m}/scan`, files = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort() : [];
  const seen = {}, names = {}, light = {}; const block = { 'no pattern, near the high but base not tight': 0, 'no pattern, not near the high': 0, 'pattern forming, stop wider than the setup allows': 0, 'pattern forming, too little room to the next high': 0, 'extended more than 25% above the 50-day': 0, other: 0 };
  let watchRows = 0, qualSum = 0, baseOkSum = 0;
  for (const f of files) {
    const j = R(`${dir}/${f}`); light[j.light] = (light[j.light] ?? 0) + 1; qualSum += j.funnel?.qualified ?? 0; baseOkSum += j.funnel?.baseQuality ?? 0;
    for (const c of j.ready ?? []) { const k = c.setup?.id; if (!k) continue; seen[k] = (seen[k] ?? 0) + 1; (names[k] ??= new Set()).add(c.sym); }
    for (const w of j.watch ?? []) { watchRows++; const ln = (w.why ?? []).find((x) => x.startsWith('Watch:')) ?? '';
      if (/stop would be wider/.test(ln)) block['pattern forming, stop wider than the setup allows']++; else if (/R of room/.test(ln)) block['pattern forming, too little room to the next high']++; else if (/extended/.test(ln)) block['extended more than 25% above the 50-day']++;
      else if (/no entry pattern/.test(ln)) block[w.distPivot != null && w.distPivot <= 5 ? 'no pattern, near the high but base not tight' : 'no pattern, not near the high']++; else block.other++; }
  }
  const by = {};
  for (const e of book.ledger) { if (e.kind !== 'trigger') continue; const k = e.setup, s = (by[k] ??= {}); const st = (s[e.stream] ??= { triggers: 0, filled: 0, closed: 0, wins: 0, sumR: 0 }); st.triggers++; if (e.entry != null) st.filled++; if (e.status === 'closed' && e.resultR != null) { st.closed++; st.sumR += e.resultR; if (e.resultR > 0) st.wins++; } }
  const setups = Object.keys(NAMES).map((id) => ({ id, name: NAMES[id], nightsReady: seen[id] ?? 0, namesReady: names[id]?.size ?? 0, streams: Object.fromEntries(Object.entries(by[id] ?? {}).map(([k, v]) => [k, { ...v, winRate: v.closed ? v.wins / v.closed : null, meanR: v.closed ? Math.round((v.sumR / v.closed) * 100) / 100 : null }])) }));
  out.markets[m] = { nights: files.length, from: files[0]?.slice(0, 10) ?? null, to: files.at(-1)?.slice(0, 10) ?? null, lightNights: light, avgQualified: files.length ? Math.round((qualSum / files.length) * 10) / 10 : null, nightsWithBaseQuality: baseOkSum, watchSightings: watchRows, block, setups,
    notes: { '3': m === 'india' ? 'Allowed in the green and yellow limits, but the scan has no earnings-gap detector, so it cannot fire yet.' : 'Not in the US limits.', '1': 'Needs a tight base (10-day range under 0.7 of the 50-day) and a close within 5% of the pivot; see the blockers.' } };
}
mkdirSync('site/data', { recursive: true }); writeFileSync('site/data/swing-setups.json', JSON.stringify(out) + '\n');
console.log(JSON.stringify(out.markets.india.setups.map((s) => [s.id, s.nightsReady, Object.keys(s.streams)])), JSON.stringify(out.markets.india.block));
