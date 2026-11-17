// US Batch C, U-3 steps 1 and 2 (docs/BATCH_C_US_PROPOSALS.md): list of 8-K Item 2.02 (earnings release) filings of the current top-500 names with filing date and time, and a COUNT of events per year
// with the distribution of run-up and reaction (market-adjusted against SPY) so the US cut can be frozen BEFORE any book return is read. No book, no strategy returns.
// Reaction session: accepted before 09:30 ET -> same session; 09:30 to 16:00 -> same session (flagged "intraday"); after 16:00 -> next session. Run-up: 20 sessions to the close before the reaction session; reaction: previous close to reaction close; both minus SPY.
// Checks: how often the reaction session is the highest-volume session within two sessions either side; quarters with two Item 2.02 filings (first one kept); names with no 8-K 2.02 (ADRs file 6-K).
// Source: data.sec.gov submissions (runner only; the 'recent' block holds about the last 1,000 filings, noted in coverage). Writes data/us/count-8k.json (summary) and data/us/eightk-202.json (event list).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), G = (p) => JSON.parse(gunzipSync(readFileSync(p)));
const syms = Object.keys(R('data/us/fundamentals/latest.json').rows);
const bars = (s) => { const f = `data/us/hist/${s}.json.gz`; return existsSync(f) ? G(f).bars : null; };
const spy = bars('SPY') ?? G('data/us/hist-bench/SPY.json.gz').bars, spyIdx = new Map(spy.map((b, i) => [b[0], i]));
const et = (iso) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).reduce((a, x) => ((a[x.type] = x.value), a), {}); return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) % 24 * 60 + Number(p.minute) }; };
const events = [], cov = { names: syms.length, noFactsFile: 0, noEightK202: 0, filings: 0, tooManyFilings: 0, secondInQuarterDropped: 0 };
for (const s of syms) {
  const ff = `data/us/facts/${s.replace(/[^A-Za-z0-9.-]/g, '_')}.json.gz`; if (!existsSync(ff)) { cov.noFactsFile++; continue; }
  const cik = String(G(ff).cik).padStart(10, '0'); let j = null;
  for (let a = 0; a < 3 && !j; a++) { try { const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) j = await r.json(); else await sleep(1000); } catch { await sleep(1000); } }
  await sleep(150); if (!j) continue;
  const rc = j.filings?.recent; if (!rc) continue; const n = rc.form.length, mine = [];
  for (let i = 0; i < n; i++) if (rc.form[i] === '8-K' && (rc.items[i] || '').split(',').includes('2.02')) mine.push({ filed: rc.filingDate[i], acc: rc.acceptanceDateTime[i], accn: rc.accessionNumber[i] });
  if (!mine.length) { cov.noEightK202++; continue; }
  if (n >= 990) cov.tooManyFilings++;
  mine.sort((a, b) => (a.filed < b.filed ? -1 : 1)); const kept = []; cov.filings += mine.length;
  for (const m of mine) { const prev = kept[kept.length - 1]; if (prev && (Date.parse(m.filed) - Date.parse(prev.filed)) / 86400000 < 45) { cov.secondInQuarterDropped++; continue; } kept.push(m); }
  const b = bars(s); if (!b) continue; const idx = new Map(b.map((x, i) => [x[0], i]));
  for (const m of kept) {
    if (m.filed < '2021-01-01') continue; const t = et(m.acc || m.filed + 'T12:00:00Z'), day = t.date;
    let k = b.findIndex((x) => x[0] >= day); if (k < 0) continue; const timing = t.min < 570 ? 'preopen' : t.min < 960 ? 'intraday' : 'afterclose';
    if (timing === 'afterclose') { if (b[k][0] === day) k++; } else if (b[k][0] > day) { /* filed on a non-session day: next session */ }
    if (k < 21 || k >= b.length) continue; const d0 = b[k][0], dPrev = b[k - 1][0], d20 = b[k - 21][0]; if (!spyIdx.has(d0) || !spyIdx.has(dPrev) || !spyIdx.has(d20)) continue;
    const sp = (a, c) => spy[spyIdx.get(c)][1] / spy[spyIdx.get(a)][1] - 1, own = (a, c) => b[c][1] / b[a][1] - 1;
    const run = own(k - 21, k - 1) - sp(d20, dPrev), rea = own(k - 1, k) - sp(dPrev, d0);
    let hv = k; for (let q = Math.max(0, k - 2); q <= Math.min(b.length - 1, k + 2); q++) if (b[q][4] > b[hv][4]) hv = q;
    events.push({ sym: s, filed: m.filed, timing, reactionDate: d0, run: +run.toFixed(4), reaction: +rea.toFixed(4), highVol: hv === k });
  }
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const byYear = {}; for (const e of events) (byYear[e.filed.slice(0, 4)] ??= []).push(e);
const summary = { rule: 'U-3 steps 1 and 2: counts and distributions only; no book returns read', coverage: cov, events: events.length,
  timing: Object.fromEntries(['preopen', 'intraday', 'afterclose'].map((k) => [k, events.filter((e) => e.timing === k).length])),
  reactionIsHighestVolumeWithinTwo: +(events.filter((e) => e.highVol).length / Math.max(1, events.length)).toFixed(3),
  perYear: Object.fromEntries(Object.entries(byYear).map(([y, es]) => [y, es.length])),
  runUp: { p33: pct(events.map((e) => e.run), 0.33), p50: pct(events.map((e) => e.run), 0.5), p67: pct(events.map((e) => e.run), 0.67) },
  reaction: { p33: pct(events.map((e) => e.reaction), 0.33), p50: pct(events.map((e) => e.reaction), 0.5), p67: pct(events.map((e) => e.reaction), 0.67) },
  eventsWithRunUpAboveP67: events.filter((e) => e.run >= pct(events.map((x) => x.run), 0.67)).length,
  ...{ both: (() => { const c = pct(events.map((x) => x.run), 0.67); return events.filter((e) => e.run >= c && e.reaction >= 0.02).length; })() } };
writeFileSync('data/us/eightk-202.json', JSON.stringify({ events })); writeFileSync('data/us/count-8k.json', JSON.stringify(summary, null, 1) + '\n'); console.log(JSON.stringify(summary, null, 1));
