// Repo Desk India whole-market stock store. Downloads NSE's daily all-stock file, keeps one compact file per session in
// data/india/bhav/, and derives data/india/stocks/latest.json (close, volume, SMAs, EMAs for every stock).
// Usage: node scripts/india-stocks.mjs [--date=YYYY-MM-DD] [--backfill=N] [--dir=data/india] [--offline=<folder of sec_bhavdata_full_DDMMYYYY.csv>]
// --backfill=N makes sure the N sessions before D are stored too (fetched oldest first, at most 300 per run).
// Exit 0 = wrote, or D's file is not published yet. Exit 1 = anything wrong; a failed run never writes latest.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { join } from 'node:path';
import { makeCalendar } from '../src/engine/calendar.ts';
import { parseBhavcopy, computeStocks, detectBreaks } from '../src/ingest/india-stocks.ts';
import { resolveBreaks, estimateOptions } from '../src/ingest/corp-actions.ts';
import { wantedSubject, parseCircularText } from '../src/ingest/circulars.ts';
import { createRequire } from 'node:module';
import { parseDhanShare, parseDhanEmas, dhanSlugs, solveFactor, checkEmas } from '../src/ingest/published-average.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const DIR = arg('dir') || 'data/india';
const OFFLINE = arg('offline');
const ACTIONS_FILE = arg('actions');      // offline: a JSON array of {symbol, subject, exDate (DD-Mon-YYYY), faceVal}
const BACKFILL = Math.min(300, Number(arg('backfill') || 0));
const calFile = loadCalendarFiles().india;
const cal = makeCalendar([...calFile.holidays, ...(calFile.priorHolidays || [])]);
const extra = (calFile.extraSessions || []).map((e) => e.date);   // special trading days outside Mon-Fri, e.g. the Budget Sunday
const todayIst = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const ddmmyyyy = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
let D = arg('date');
if (!D) { D = todayIst; while (!cal.isSession(D)) D = cal.prevSession(D); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** csv text, or null on 404. Throws on anything else after retries. */
async function getFile(iso) {
  const name = `sec_bhavdata_full_${ddmmyyyy(iso)}.csv`;
  if (OFFLINE) { const p = join(OFFLINE, name); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
  // archives.nseindia.com answers 404 for a file that does not exist; nsearchives answers 200 with a "not accessible in your region" page
  // for a missing file. So: 404 on archives, then HTML on nsearchives, means "not published yet", not an error.
  let lastErr, sawMissing = false;
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    for (let a = 0; a < 3; a++) {
      try {
        const res = await fetch(`https://${host}/products/content/${name}`, { headers: H, redirect: 'follow' });
        if (res.status === 404) { sawMissing = true; break; }
        if (!res.ok) { lastErr = new Error(`${host} ${res.status}`); await sleep(2000 * (a + 1)); continue; }
        const text = await res.text();
        if (/^\s*<(!doctype|html)/i.test(text)) { if (sawMissing) break; lastErr = new Error(`${host} returned HTML instead of CSV`); await sleep(2000 * (a + 1)); continue; }
        return text;
      } catch (e) { lastErr = e; await sleep(2000 * (a + 1)); }
    }
  }
  if (sawMissing) return null;
  throw lastErr;
}

const write = (p, o, pretty = false) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, pretty ? JSON.stringify(o, null, 1) + '\n' : JSON.stringify(o) + '\n'); };
const report = { ts: new Date().toISOString(), date: D, status: 'unknown', fetched: [], skipped: [], notPublished: false, sessionsStored: 0, stocks: 0, flags: [] };
const finish = (code, status) => { report.status = status; write(join(DIR, 'last-run-stocks.json'), report, true); console.log(JSON.stringify(report).slice(0, 3000)); process.exit(code); };

const bhavDir = join(DIR, 'bhav');
mkdirSync(bhavDir, { recursive: true });
const stored = () => new Set(readdirSync(bhavDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, 10)));

// Sessions to make sure we have: N sessions before D, then D.
const want = [];
for (let i = 0, d = D; i < BACKFILL; i++) { d = cal.prevSession(d); want.unshift(d); }
want.push(D);
for (const e of extra) if (e < D && e >= want[0] && !want.includes(e)) want.unshift(e);
want.sort();
const have = stored();
for (const iso of want) {
  if (have.has(iso)) continue;
  let text;
  try { text = await getFile(iso); } catch (e) { report.flags.push(`${iso}: ${e.message}`); if (iso === D) finish(1, 'fetch error'); continue; }
  if (text === null) { if (iso === D) report.notPublished = true; else report.skipped.push(`${iso}: no file (holiday?)`); continue; }
  let day;
  try { day = parseBhavcopy(text); } catch (e) { report.flags.push(`${iso}: ${e.message}`); if (iso === D) finish(1, 'parse error'); continue; }
  if (day.date !== iso) { report.skipped.push(`${iso}: file carries ${day.date}, not stored`); if (iso === D) finish(1, 'wrong date in file'); continue; }
  if (Object.keys(day.rows).length < 1000) { report.flags.push(`${iso}: only ${Object.keys(day.rows).length} stocks`); if (iso === D) finish(1, 'file too small'); continue; }
  write(join(bhavDir, `${iso}.json`), day);
  report.fetched.push(iso);
  if (!OFFLINE) await sleep(300);
}

const all = [...stored()].filter((d) => d <= D).sort();
report.sessionsStored = all.length;
if (report.notPublished || all[all.length - 1] !== D) finish(0, `file for ${D} not published yet`);

// Corporate actions: refresh the stored list from NSE (union by symbol, date and subject, so past events never disappear).
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const isoDate = (s) => { const m = /^(\d+)-(\w{3})-(\d{4})$/.exec(s || ''); return m && MON[m[2]] ? `${m[3]}-${String(MON[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const actionsPath = join(DIR, 'corp-actions.json');
let actions = existsSync(actionsPath) ? JSON.parse(readFileSync(actionsPath, 'utf8')) : [];
let lastStatus = '';
async function fetchActions() {
  if (ACTIONS_FILE) return JSON.parse(readFileSync(ACTIONS_FILE, 'utf8'));
  if (OFFLINE) return [];
  let cookie = '';
  for (const u of ['https://www.nseindia.com/', 'https://www.nseindia.com/companies-listing/corporate-filings-actions']) {
    const r = await fetch(u, { headers: { ...H, cookie }, redirect: 'follow' });
    const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]);
    if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; ');
  }
  const from = new Date(Date.parse(D) - 370 * 864e5).toISOString().slice(0, 10).split('-').reverse().join('-');
  const to = D.split('-').reverse().join('-');
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=${from}&to_date=${to}`, { headers: { ...H, cookie, referer: 'https://www.nseindia.com/companies-listing/corporate-filings-actions' } });
    lastStatus = `${r.status}`;
    if (r.ok) { const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch { lastStatus = `not JSON: ${txt.slice(0, 80)}`; } const arr = Array.isArray(j) ? j : (j?.data || []); if (arr.length) return arr; if (j) lastStatus = `empty list from ${from} to ${to}: ${txt.slice(0, 80)}`; }
    await sleep(2000 * (a + 1));
  }
  throw new Error(`corporate-actions list unavailable (${lastStatus})`);
}
try {
  const fresh = await fetchActions();
  const seen = new Set(actions.map((a) => `${a.symbol}|${a.exDate}|${a.subject}`));
  for (const a of fresh) {
    const ex = isoDate(a.exDate) || (/^\d{4}-/.test(a.exDate || '') ? a.exDate : null);
    if (!ex || !a.symbol) continue;
    const rec = { symbol: a.symbol, subject: a.subject, exDate: ex, faceVal: a.faceVal };
    const k = `${rec.symbol}|${rec.exDate}|${rec.subject}`;
    if (!seen.has(k)) { seen.add(k); actions.push(rec); }
  }
  actions.sort((x, y) => (x.exDate + x.symbol).localeCompare(y.exDate + y.symbol));
  write(actionsPath, actions);
} catch (e) { report.flags.push(`corporate-actions list not refreshed: ${e.message}${actions.length ? ' (using the stored list)' : ' (no list, every break stays unresolved)'}`); }
const overridesPath = join(DIR, 'corp-action-overrides.json');
const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};
const idx = existsSync(join(DIR, 'idx_closes.json')) ? JSON.parse(readFileSync(join(DIR, 'idx_closes.json'), 'utf8')).closes['Nifty 500'] || {} : {};
const mdates = Object.keys(idx).sort();
const marketReturn = (d) => { const i = mdates.indexOf(d); return i > 0 ? idx[d] / idx[mdates[i - 1]] - 1 : null; };

// Derive from the last 260 stored sessions (enough for a 200 SMA plus margin).
const days = all.slice(-260).map((d) => JSON.parse(readFileSync(join(bhavDir, `${d}.json`), 'utf8')));
const cons = (a, b) => cal.sessionsBetween(a, b) <= 1;
const AGED = 205;   // a break this many sessions back no longer sits inside any 200-close window or EMA warm-up
const derivedPath = join(DIR, 'corp-action-derived.json');
const derived = existsSync(derivedPath) ? JSON.parse(readFileSync(derivedPath, 'utf8')) : {};
const asOverrides = () => Object.fromEntries(Object.entries(derived).map(([k, v]) => [k, { factor: v.factor, derived: true, note: `published average (${v.source}, ${v.asOf})` }]));

// NSE circulars: the exchange's own notices of face-value splits (equity and ETF unit splits). Read once, cached in circulars.json.
const circPath = join(DIR, 'circulars.json');
const circ = existsSync(circPath) ? JSON.parse(readFileSync(circPath, 'utf8')) : { fetchedThrough: '', items: {} };
report.circulars = { checked: 0, newlyRead: 0, unreadable: [], errors: 0, problem: null };
async function refreshCirculars() {
  if (OFFLINE) return;
  let pdfParse;
  try { pdfParse = createRequire(import.meta.url)('pdf-parse/lib/pdf-parse.js'); } catch { report.circulars.problem = 'pdf-parse is not installed (run npm ci)'; return; }
  const base = 'https://www.nseindia.com';
  let cookie = '';
  for (const u of [base + '/', base + '/resources/exchange-communication-circulars']) {
    const r = await fetch(u, { headers: { ...H, cookie }, redirect: 'follow' });
    const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]);
    if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; ');
  }
  const HA = { ...H, cookie, referer: base + '/resources/exchange-communication-circulars', accept: 'application/json, text/plain, */*' };
  const universe = new Set(days.flatMap((d) => Object.keys(d.rows)));
  const prefer = new Set(detectBreaks(days, cons).map((b) => b.symbol));
  const startIso = circ.fetchedThrough ? new Date(Date.parse(circ.fetchedThrough) - 10 * 864e5).toISOString().slice(0, 10) : all[0];
  const dmy = (iso) => iso.split('-').reverse().join('-');
  const list = new Map();
  for (let a = startIso; a <= D; ) {
    const b = new Date(Math.min(Date.parse(a) + 14 * 864e5, Date.parse(D))).toISOString().slice(0, 10);
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++) {
      const r = await fetch(`${base}/api/circulars?fromDate=${dmy(a)}&toDate=${dmy(b)}`, { headers: HA });
      if (r.ok) { try { const j = await r.json(); for (const c of (Array.isArray(j) ? j : j.data || [])) list.set(c.circDisplayNo, c); ok = true; } catch {} }
      if (!ok) await sleep(1500 * (t + 1));
    }
    if (!ok) throw new Error(`circular list unavailable for ${a} to ${b}`);
    a = new Date(Date.parse(b) + 864e5).toISOString().slice(0, 10);
  }
  report.circulars.checked = list.size;
  for (const [no, v] of Object.entries(circ.items)) if (!['read', 'skipped'].includes(v.status) && !list.has(no)) list.set(no, { circDisplayNo: no, sub: v.sub, cirDate: v.date, circFilelink: v.link });   // retry earlier failures
  for (const c of list.values()) {
    if (!wantedSubject(c.sub)) continue;
    const known = circ.items[c.circDisplayNo];
    if (known && (known.status === 'read' || known.status === 'skipped')) continue;
    const rec = { date: c.cirDate, sub: c.sub, link: c.circFilelink };
    try {
      const r = await fetch(c.circFilelink.replace('nsearchives.', 'archives.'), { headers: H });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.subarray(0, 4).toString('latin1') !== '%PDF') throw new Error(`not a PDF (${r.status})`);
      const text = (await pdfParse(buf)).text;
      const p = parseCircularText(text, c.circDisplayNo, universe, prefer);
      if (!p) circ.items[c.circDisplayNo] = { ...rec, status: 'skipped' };
      else if (!p.items.length && ((m) => m && !universe.has(m[1]))(/\(([A-Z0-9&-]+)\)\s*$/.exec(c.sub))) circ.items[c.circDisplayNo] = { ...rec, status: 'skipped', note: 'symbol not in the all-stock file (SME board)' };
      else if (!p.items.length) { circ.items[c.circDisplayNo] = { ...rec, status: 'unreadable', effective: p.effective }; report.circulars.unreadable.push(c.circDisplayNo); }
      else { circ.items[c.circDisplayNo] = { ...rec, status: 'read', effective: p.effective, items: p.items }; report.circulars.newlyRead++; }
    } catch (e) { report.circulars.errors++; circ.items[c.circDisplayNo] = { ...rec, status: 'error', error: String(e.message || e).slice(0, 100) }; }
  }
  circ.fetchedThrough = D;
  write(circPath, circ);
}
try { await refreshCirculars(); } catch (e) { report.circulars.problem = `circular list not refreshed: ${e.message} (using the stored circulars)`; }
if (report.circulars.problem) report.flags.push(report.circulars.problem);
if (report.circulars.unreadable.length) report.flags.push(`circulars that look like splits but could not be read: ${report.circulars.unreadable.join(', ')}`);
// Each read circular becomes an override on the first stored session on or after its effective date; the resolver applies it only if the price break agrees.
const circularOverrides = () => {
  const o = {};
  for (const [no, c] of Object.entries(circ.items)) {
    if (c.status !== 'read') continue;
    const day = days.find((d) => d.date >= c.effective);
    if (!day) continue;
    for (const it of c.items) o[`${it.symbol}|${day.date}`] = { factor: it.to / it.from, circular: no, note: `NSE circular ${no} of ${c.date.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')}: ${c.sub}; face value ${it.from} to ${it.to}, effective ${c.effective}` };
  }
  return o;
};
const allOverrides = () => ({ ...asOverrides(), ...circularOverrides(), ...overrides });
let res = resolveBreaks(days, actions, allOverrides(), cons, marketReturn);

// Backup for breaks the NSE list cannot explain: solve the factor from Dhan's published 200 DMA, cross-check with its EMAs.
async function getText(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' });
  if (!r.ok) return null;
  return (await r.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}
report.derivation = { tried: 0, derived: [], failed: [] };
if (!OFFLINE && !ACTIONS_FILE && res.unresolved.length) {
  let names = null;
  try {
    const t = await (await fetch('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv', { headers: H })).text();
    names = new Map(t.split(/\r?\n/).slice(1).map((l) => l.split(',')).filter((c) => c.length > 1).map((c) => [c[0].trim(), c[1].trim()]));
  } catch (e) { report.flags.push(`company names unavailable (${e.message}); published-average backup skipped`); }
  const bySym = {};
  for (const u of res.unresolved) (bySym[u.symbol] ??= []).push(u);
  for (const [sym, us] of names ? Object.entries(bySym) : []) {
    const note = (why) => report.derivation.failed.push(`${sym} ${us.map((u) => u.date).join(',')}: ${why}`);
    if (us.length > 1) { note('more than one unresolved break'); continue; }
    const u = us[0];
    if (!names.get(sym)) { note('no company name'); continue; }
    report.derivation.tried++;
    // Series of this stock's closes (already adjusted for resolved events) through D.
    const dates = [], closes = [];
    for (const d of days) if (d.rows[sym]) { dates.push(d.date); closes.push(d.rows[sym][5]); }
    const evs = res.options.factors?.[sym] ?? [];
    const adj = closes.map((c, i) => c * evs.filter((e) => e.date > dates[i]).reduce((p, e) => p * e.factor, 1));
    const bi = dates.indexOf(u.date);
    let page = null, slug = null;
    for (const sl of dhanSlugs(names.get(sym))) {
      const txt = await getText(`https://dhan.co/stocks/${sl}-share-price/`).catch(() => null); await sleep(400);
      if (!txt) continue;
      const p = parseDhanShare(txt);
      if (p.symbol && p.symbol.toUpperCase() === sym.toUpperCase()) { page = p; slug = sl; break; }
    }
    if (!page) { note('Dhan page not found'); continue; }
    if (page.asOf !== D) { note(`Dhan page dated ${page.asOf}, not ${D}`); continue; }   // the time of day is the last trade, not the page time; the close check below guards the rest
    if (!page.close || Math.abs(page.close / closes[closes.length - 1] - 1) > 0.003) { note('Dhan close differs from the NSE close'); continue; }
    if (!page.dma200) { note('no 200 DMA on the page'); continue; }
    const sol = solveFactor(adj, bi, page.dma200);
    if (!sol) { note('break is outside the 200-close window'); continue; }
    const resid = Math.abs(u.ratio / sol.factor - 1);
    if (resid > 0.20) { note(`derived factor ${sol.factor.toFixed(4)} leaves a ${(resid * 100).toFixed(0)}% day change`); continue; }
    const tech = await getText(`https://dhan.co/stocks/${slug}-technical-analysis/`).catch(() => null); await sleep(400);
    const emas = tech ? parseDhanEmas(tech) : {};
    const ck = checkEmas(adj, bi, sol.factor, emas);
    if (!ck.ok) { note(`EMA cross-check failed (worst ${ck.worstPct}%)`); continue; }
    derived[`${sym}|${u.date}`] = { factor: Math.round(sol.factor * 1e6) / 1e6, source: 'Dhan 200 DMA, EMA cross-check', asOf: D, published200: page.dma200, emaWorstPct: ck.worstPct };
    report.derivation.derived.push(`${sym} ${u.date} ${sol.factor.toFixed(4)} (EMA worst ${ck.worstPct}%)`);
  }
  if (report.derivation.derived.length) {
    write(derivedPath, derived, true);
    res = resolveBreaks(days, actions, allOverrides(), cons, marketReturn);
  }
}
const dayIdx = new Map(days.map((d, i) => [d.date, i]));
const aged = res.unresolved.filter((u) => days.length - 1 - dayIdx.get(u.date) >= AGED);
res.unresolved = res.unresolved.filter((u) => !aged.includes(u));
const stocks = computeStocks(days, D, cons, res.options);
// Estimated averages for stocks with an unresolved break: kept apart, never in sma50/sma200.
const est = computeStocks(days, D, cons, estimateOptions(res.options, res.unresolved));
for (const u of res.unresolved) {
  const s = stocks[u.symbol], e = est[u.symbol];
  if (!s || !e || !u.estimate) continue;
  s.estimated = { basis: u.estimate.basis, factor: Math.round(u.estimate.factor * 1e6) / 1e6, sma50: e.sma50, sma200: e.sma200, ema10: e.ema10, ema20: e.ema20 };
}
// Say on each stock's own record what it was adjusted for (the resolver's accepted actions), so nobody has to dig through corporateActions.
for (const r of res.resolved) {
  const s = stocks[r.symbol]; if (!s) continue;
  (s.adjustedFor ??= []).push({ date: r.date, factor: r.factor, confidence: r.confidence, source: r.how });
}
report.stocks = Object.keys(stocks).length;
const warm = Object.values(stocks).filter((s) => s.emaWarm).length;
const withSma200 = Object.values(stocks).filter((s) => s.sma200 !== undefined).length;
const adjusted = Object.entries(stocks).filter(([, s]) => s.adjusted.length).map(([k, s]) => `${k} ${s.adjusted.join(',')}`);
report.flags.push(`${withSma200} of ${report.stocks} stocks have a 200 SMA; ${warm} have a warm EMA`);
report.flags.push(`corporate actions: ${res.resolved.length} breaks adjusted (${res.resolved.filter((r) => r.confidence === 'approx').length} approximate, ${res.resolved.filter((r) => r.confidence === 'derived').length} derived from a published average), ${res.real.length} accepted as real moves, ${res.unresolved.length} unresolved (averages omitted)${aged.length ? `, ${aged.length} older than the averages now reach` : ''}`);
const cpAll = [];
for (const m of res.circularMismatch.filter((m) => res.unresolved.some((u) => u.symbol === m.symbol && u.date === m.date))) cpAll.push(`${m.symbol} ${m.date}: circular ${m.circular} says x${m.factor.toFixed(4)} but the price moved x${m.ratio}`);
for (const n of report.circulars.unreadable) cpAll.push(`circular ${n} not readable`);
const cpPath = join(DIR, 'stocks', 'circular-problems-seen.json');
const cpSeen = existsSync(cpPath) ? new Set(JSON.parse(readFileSync(cpPath, 'utf8'))) : new Set();
report.circularProblems = cpAll.filter((x) => !cpSeen.has(x));   // only new ones are alerted
write(cpPath, cpAll);
if (res.resolved.some((r) => r.confidence === 'circular') || res.circularMismatch.length) report.flags.push(`NSE circulars: ${res.resolved.filter((r) => r.confidence === 'circular').length} breaks explained, ${res.circularMismatch.length} where the circular alone does not match the price move (${res.circularMismatch.filter((m) => !res.unresolved.some((u) => u.symbol === m.symbol && u.date === m.date)).length} of them explained by the list, e.g. split plus bonus on one day)`);
if (adjusted.length) report.flags.push(`prices adjusted for corporate actions in the window: ${adjusted.length} stocks`);
write(join(DIR, 'stocks', 'latest.json'), {
  date: D, fetchedAt: new Date().toISOString(), src: `NSE all-stock file (${D}); averages computed from ${all.length} stored sessions`,
  count: report.stocks, stocks,
  corporateActions: { resolved: res.resolved, unresolved: res.unresolved, real: res.real },
});
// New unresolved breaks since the last run, for the alert.
const prevPath = join(DIR, 'stocks', 'unresolved-seen.json');
const seenU = existsSync(prevPath) ? new Set(JSON.parse(readFileSync(prevPath, 'utf8'))) : new Set();
const nowU = res.unresolved.map((u) => `${u.symbol}|${u.date}`);
report.newUnresolved = nowU.filter((k) => !seenU.has(k));
write(prevPath, nowU);
finish(0, 'written');
