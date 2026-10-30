// Tonight's Swing orders for the household, assembled from the saved accounts (Engine Rules C-111, Portfolio Manager phase 9). Pure.
// This is the code that used to sit inside site/upload.html (poolsCard, ordersCard, householdJournal, calcAccount). It now lives here so the Portfolio page and the nightly script
// (scripts/sized-shortlist.mjs) run the same lines and cannot disagree. No rule changes: sizing is still sizeOrders (src/pm/swingorders.ts), pools still derivePools (src/pm/swingpools.ts).
// Reports are the output of runPipeline; they are typed loosely here because the page and the script both pass them straight through.
import { allocate, currentByClass, TARGET_CLASSES } from './allocation.js';
import { derivePools } from './swingpools.js';
import { journalReport } from './swingjournal.js';
import { openRiskOf, sizeOrders,                                                           } from './swingorders.js';
import { isLong } from './rebalance.js';
import { fy } from './tax.js';

export const ownerOf = (a                    )         => a.owner || 'Unassigned';
export const normName = (n         )         => String(n ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(limited|ltd)\b/g, '').replace(/\s+/g, ' ').trim();

/** Holdings of several reports merged by kind and name, largest first. */
export function mergeHoldings(reports       )        {
  const by = new Map             ();
  for (const r of reports) for (const h of r.holdings) {
    const k = h.kind + '|' + h.name;
    const e = by.get(k) ?? by.set(k, { name: h.name, symbol: h.symbol, isin: h.isin, kind: h.kind, book: h.book, assetClass: h.assetClass ?? null, category: h.category, locked: 0, qty: 0, cost: 0, value: 0, anyNull: false }).get(k);
    e.qty += h.qty; e.cost += h.cost; e.locked += h.locked ?? 0; if (h.value === null) e.anyNull = true; else e.value += h.value;
  }
  return [...by.values()].map((e) => ({ ...e, value: e.anyNull ? null : e.value })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/** One account's allocation: its capital (typed, or what it holds), profile, horizon and the targets that follow (the swing capital is the direct-equity target). `A` is the account's saved settings. */
export function acctAllocation(C     , report     , A     ) {
  const hs = mergeHoldings([report]);
  const outside = (A.outside ?? []).filter((o     ) => o.value > 0);   // typed by the owner: EPF and the like
  const held = [...hs.map((h) => ({ name: h.name, value: h.value, cls: h.assetClass ?? null, category: h.category, kind: h.kind })), ...outside.map((o     ) => ({ name: o.name, value: o.value, cls: o.cls, kind: 'Outside' }))];
  const lockedElss = hs.reduce((t, h) => t + (h.locked ?? 0), 0), cur = currentByClass(C, held       );
  const capital = A.capital > 0 ? A.capital : Math.round(cur.total + cur.unclassified), profile = A.profile ?? 'Balanced', horizon = A.horizon ?? 10, off = new Set        (A.off ?? []);
  const res = allocate(C, { capital, profile, horizonYears: horizon, buffer: A.buffer, inScope: TARGET_CLASSES.filter((c) => !off.has(c)), custom: A.custom }       )       ;
  return { hs, held, lockedElss, cur, capital, profile, horizon, off, res };
}

/** The journal of recognised Swing trades across the household (C-77) and what blocks the Journal Test while questions are open. `xs` entries: { a: { label, key, report }, res }. */
export function householdJournal(xs       ) {
  const ok = xs.filter((x) => x.res.ok && x.res.rows.some((r     ) => r.cls === 'direct_equity'));
  const start = ok.reduce((t, x) => t + x.res.rows.find((r     ) => r.cls === 'direct_equity').amount, 0);
  const trades = ok.flatMap((x) => (x.a.report.journal ?? []).map((t     ) => ({ ...t, acct: x.a.label, acctKey: x.a.key })));
  const rep = journalReport(trades, start), blocked           = [];
  if (ok.some((x) => (x.a.report.saleProposals ?? []).length)) blocked.push('sales waiting for your answer');
  if (ok.some((x) => (x.a.report.swingProposals ?? []).length)) blocked.push('near-match buys waiting for your answer');
  if (ok.some((x) => (x.a.report.resolver?.unexplained ?? []).length)) blocked.push('sells the statements cannot explain');
  if (ok.some((x) => (x.a.report.journalSkipped ?? []).length)) blocked.push('trades left out after a split or demerger');
  if (trades.some((t     ) => t.closed && t.r === null)) blocked.push('a closed trade with no usable stop');
  if (blocked.length) rep.provenGreen = false;
  return { rep, ok, blocked };
}

/** Accounts that take part in the swing pools: the allocation worked out and it has a direct-equity target. */
export const poolAccounts = (xs       )        => xs.filter((x) => x.res.ok && x.res.rows.some((r     ) => r.cls === 'direct_equity'));

/** The pools: each account's swing capital (own direct-equity target), value in swing, room and positions, plus each owner's short-term gains this financial year (for the routing tax step). `P` = settings.swingPools. */
export function poolInputs(ok       , P     , today        ) {
  const nowFy = fy(today), cap                         = {};
  const accts = ok.map((x) => {
    cap[x.a.label] = x.res.rows.find((r     ) => r.cls === 'direct_equity').amount; const r = x.a.report;
    return { label: x.a.label, owner: ownerOf(x.a), value: x.cur.total, swingValue: r.books?.Swing?.value ?? 0, swingNames: (r.openLots ?? []).filter((l     ) => l.book === 'Swing').map((l     ) => l.name), capitalSource: P.capitalSource };
  });
  const rows = derivePools(accts, cap), stcg                         = {};
  for (const x of ok) { const y = x.a.report.tax.find((t     ) => t.fy === nowFy); stcg[ownerOf(x.a)] = (stcg[ownerOf(x.a)] ?? 0) + (y ? y.equity.stcg : 0); }
  return { accts, cap, rows, stcg };
}

/** Tonight's OFFICIAL candidates, in the order the plan lists them: the scan's Ready list first, then the paper book's official-stream orders for tonight. Capwaived and comparator picks are paper-test only (see paperPicks) and never reach the order list (C-113). */
export function candidatesFrom(scan     , paper     , names                         = {})         {
  const cands         = [], seen = new Set        ();
  for (const c of scan?.ready ?? []) if (c.setup && !seen.has(c.sym)) { seen.add(c.sym); cands.push({ sym: c.sym, name: names[c.sym], setup: c.setup.id, trigger: c.setup.trigger, stop: c.setup.stop, atr: c.diag?.atr14 ?? undefined, close: c.close }); }
  for (const o of paper?.newOrdersTonight ?? []) if (o.stream === 'official' && !seen.has(o.sym)) { seen.add(o.sym); cands.push({ sym: o.sym, name: names[o.sym], setup: o.setup, trigger: o.trigger, stop: o.stop }); }
  return cands;
}
                                                     
                                                                                                                                                                     
/** Tonight's paper-test picks (capwaived and comparator streams of the India paper book, C-53). A symbol that is also an official candidate is still listed here under its own stream. */
export function paperPicks(paper     , names                         = {})              {
  return (paper?.newOrdersTonight ?? []).filter((o     ) => o.stream === 'capwaived' || o.stream === 'comparator').map((o     ) => ({
    stream: o.stream               , cand: { sym: o.sym, name: names[o.sym], setup: o.setup, trigger: o.trigger, stop: o.stop }, kind: o.kind ?? (o.stream === 'comparator' ? 'close' : 'trigger'),
    tags: o.tags ?? [], stopPct: typeof o.stopPct === 'number' ? o.stopPct : null, maxStopPct: typeof o.maxStopPct === 'number' ? o.maxStopPct : null, roomR: typeof o.roomR === 'number' ? o.roomR : null }));
}
/** Company names the dashboard shows (build-site.mjs): only for the symbols on the scan's Ready and Watch lists and the paper book's live and recent lists, not for tonight's new orders. Kept the same so a name matches an account's own name the same way on the page and at night. */
export function dashNames(scan     , paper     , namesIndia                         = {})                         {
  const out                         = {};
  for (const x of [...(scan?.ready ?? []), ...(scan?.watch ?? []), ...(paper?.live ?? []), ...(paper?.recent ?? [])]) { const n = namesIndia[x.sym]; if (n && !out[x.sym]) out[x.sym] = n; }
  return out;
}

                                                                                                                                
/** Sizes and routes the candidates across the household. `ok` = poolAccounts(...), `pool` = poolInputs(...). */
export function orderRun(ok       , pool                                                             , cands        , ctx             )                                                                                           {
  const oa              = ok.map((x, i) => {
    const lots = x.a.report.openLots ?? [], r = openRiskOf(lots, x.A?.stops ?? {}), swingNames           = pool.accts[i].swingNames;
    const blocked = lots.filter((l     ) => l.book === 'Legacy' && isLong(ctx.taxRules, l, ctx.today) === false).map((l     ) => l.name);
    const heldValue                         = {}; for (const l of lots) if (l.book === 'Swing') heldValue[l.name] = (heldValue[l.name] ?? 0) + l.qty * l.price;
    return { ...pool.accts[i], ...r, blocked, swingNames, heldValue };
  });
  // use the account's own name for a stock when it holds it, so "already held" and blocks match
  const own = new Map                (); for (const a of oa) for (const n of [...a.swingNames, ...a.blocked]) own.set(normName(n), n);
  const named = cands.map((c) => { const k = normName(c.name ?? c.sym); return { ...c, name: own.has(k) ? own.get(k) : (c.name ?? c.sym) }; });
  const jr = householdJournal(ok).rep;
  const out = sizeOrders(named, oa, pool.rows, { light: ctx.light, vix: ctx.vix, s: ctx.P, stcgYtd: pool.stcg, taxRowConfident: ctx.taxRowConfident, provenGreen: jr.provenGreen, halving: jr.halving });
  return { out, oa, journal: jr };
}

// ---- The nightly overlay (private repo only): the sized lines plus which accounts' ledgers are too old to size from.
                                                                              
                          
                                                                                                                              
                                                                                                                                                                                                                                                       
 
/** A reason in fewer words: the stop-width skip says the numbers and nothing else. */
export function shortReason(r        )         {
  const m = /^the stop is ([\d.]+)% below the entry after the 1\.5 ATR floor, over the ([\d.]+)% limit for (.+): skip, do not resize$/.exec(r);
  return m ? `stop ${m[1]}% below entry, over the ${m[2]}% limit for ${m[3]}` : r;
}
const dayDiff = (a        , b        ) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
/** Accounts whose last save is more than `maxAgeDays` days before `asOf` (design section 1.1: a stale ledger is never used silently). */
export function staleAccounts(accts                                       , asOf        , maxAgeDays        )              {
  return accts.flatMap((a) => {
    if (!a.savedAt) return [{ label: a.label, savedAt: '', ageDays: Infinity }];
    const age = dayDiff(a.savedAt, asOf); return age > maxAgeDays ? [{ label: a.label, savedAt: a.savedAt.slice(0, 10), ageDays: age }] : [];
  });
}
/** The overlay file. A stale account's quantities are blanked with the reason, a line routed to it is not placed, and the file carries a banner; the other accounts keep their sizes. */
export function buildOverlay(p                                                                                                                                                                         )          {
  const staleBy = new Map(p.stale.map((s) => [s.label, s])), why = (s           ) => (s.savedAt ? `ledger last saved ${s.savedAt}, ${s.ageDays} days ago (limit ${p.maxAgeDays}): not sized` : 'ledger has no save date: not sized');
  const lines = p.out.lines.map((l0) => {
    const l = { ...l0, close: p.closes?.[l0.sym] ?? null };
    const perAccount = l.perAccount.map((a) => { const s = staleBy.get(a.label); return s ? { ...a, qty: 0, first: 0, value: 0, ok: false, binding: why(s), note: why(s) } : a; });
    const routed = l.account ? staleBy.get(l.account) : undefined;
    // why nobody can take it, from the accounts that are not stale (their reasons are about the stock and the limits); when every account is stale, from all of them
    const own = l.perAccount.filter((a) => !staleBy.has(a.label)), src = own.length ? own : l.perAccount, notes = src.map((a) => shortReason(a.note ?? a.binding)), u = [...new Set(notes)];
    const reason = u.length <= 1 ? (u[0] ?? l.verdict) : src.map((a, i) => `${a.label}: ${notes[i]}`).join('; ');
    if (routed) return { ...l, perAccount, account: null, verdict: `Not sized: ${l.account}: ${why(routed)}`, reason: `it would go to ${l.account}, whose ledger is too old to size` };
    // a line nobody can take: say why again from the (now blanked) per-account reasons, so a stale account is named and not shown under the reason it would have had
    const verdict = !l.account && l.verdict.startsWith('No account can take it: ') && perAccount.some((a, i) => a !== l.perAccount[i]) ? 'No account can take it: ' + perAccount.map((a) => `${a.label}: ${a.note ?? a.binding}`).join('; ') : l.verdict;
    return { ...l, perAccount, verdict, reason: l.account ? null : reason };
  });
  const banner = p.stale.length ? `Not sized for ${p.stale.map((s) => s.label).join(', ')}: ${p.stale.map(why).join('; ')}. Upload the account again to size it. Household limits for the other accounts still count that account's last known positions.` : null;
  const o = p.out;
  return { asOf: p.asOf, light: o.light, vix: p.vix, ledgerMaxAgeDays: p.maxAgeDays, stale: p.stale.map((s) => ({ ...s, ageDays: Number.isFinite(s.ageDays) ? s.ageDays : -1 })), banner,
    risk: o.risk, cap: o.cap, maxPos: o.maxPos, why: o.why, householdOpenRisk: Math.round(o.householdOpenRisk), householdCapRs: Math.round(o.householdCapRs), householdPositions: o.householdPositions, accounts: p.accounts, notes: o.notes, lines };
}

/** '2026-10-13' as '13 Oct'. */
const dm = (d        ) => (d ? new Date(d.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
/** "close 1625.00, needs +4.0%" : where tonight's close sits against a buy-above level. */
export function awayText(entry        , close                           )         {
  if (!(typeof close === 'number' && close > 0)) return '';
  const g = (entry / close - 1) * 100;
  return g > 0 ? `close ${close.toFixed(2)}, needs +${g.toFixed(1)}%` : `close ${close.toFixed(2)}, already above it`;
}
/** The Telegram text for the OFFICIAL orders (Engine Rules C-113): what to buy tonight, what was skipped and why (each in a few words), and which accounts were not sized. Sent every night. Paper-test picks are never in it (see paperMessage). */
export function sizedMessage(ov         , maxLines = 10)                {
  const placed = ov.lines.filter((l) => l.account), rest = ov.lines.filter((l) => !l.account);
  const day = new Date(ov.asOf + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const out           = [`Swing orders · OFFICIAL · ${day} · ${ov.light ? ov.light.toUpperCase() + ' light' : 'NO market light'}`];
  if (ov.light) out.push(`Risk ${ov.risk}% of swing capital per trade, up to ${ov.maxPos} swing positions.`); else out.push('No market light is saved, so nothing is sized.');
  if (ov.light) {
    out.push('', 'BUY TONIGHT');
    if (!placed.length) out.push('No official orders tonight.');
    for (const l of placed.slice(0, maxLines)) { const a = l.perAccount.find((p) => p.label === l.account) , aw = awayText(l.entry, l.close); out.push(`• ${l.name} (${l.setup}): ${l.account} buy ${a.qty}, first ${a.first}, buy above ${l.entry}${aw ? ` (${aw})` : ''}, stop ${l.stop}. Limit: ${a.binding}.`); }
    if (placed.length > maxLines) out.push(`+${placed.length - maxLines} more on the Scans tab.`);
    if (rest.length) {
      out.push('', `SKIPPED (${rest.length})`);
      for (const l of rest.slice(0, maxLines)) out.push(`• ${l.name}: ${l.reason ?? l.verdict}`);
      if (rest.length > maxLines) out.push(`+${rest.length - maxLines} more on the Scans tab.`);
    }
  }
  if (ov.stale.length) {
    out.push('', `NOT SIZED (ledger older than ${ov.ledgerMaxAgeDays} days)`);
    for (const s of ov.stale) out.push(`• ${s.label}: ${s.savedAt ? `saved ${dm(s.savedAt)}, ${s.ageDays} days ago` : 'no save date'}`);
    out.push('Upload them again to include them.');
  }
  out.push('', 'A suggestion, never an order. Paper-test picks are in a separate message.');
  return out.join('\n');
}

// ---- The paper-test file (private repo only; Engine Rules C-113): the paper book's capwaived and comparator picks for tonight, each tagged with its stream. Never sized against real accounts.
                                                                                                                                                                                                                                                                           
                                                                                                                                   
                                                                                                                          
export const PAPER_NOTICE = 'Not for placing. These paper trades test whether the stop-width cap and the room rule cost winners (C-53). Read at 300 picks or 12 months, whichever is later.';
/** What the LIVE rules say about each paper pick, from a separate sizing run per stream so paper picks never use real open-risk room or position slots. Keyed `stream:sym`. Empty when the accounts cannot be sized. */
export function paperVerdicts(ok       , pool                                                             , picks             , ctx             , stale             , maxAgeDays        )                         {
  const res                         = {};
  for (const stream of ['capwaived', 'comparator']                 ) {
    const cands = picks.filter((p) => p.stream === stream).map((p) => p.cand); if (!cands.length) continue;
    const { out } = orderRun(ok, pool, cands, ctx), ov = buildOverlay({ asOf: ctx.today, light: ctx.light, vix: null, out, stale, maxAgeDays, accounts: ok.map((x) => x.a.label) });
    for (const l of ov.lines) res[`${stream}:${l.sym}`] = l.account ? 'passes the live rules' : (l.reason ?? l.verdict);
  }
  return res;
}
export function buildPaperTest(p                                                                                                                                           )            {
  const lines              = p.picks.map((k) => ({ stream: k.stream, sym: k.cand.sym, name: k.cand.name ?? k.cand.sym, setup: String(k.cand.setup), kind: k.kind, entry: k.cand.trigger, stop: k.cand.stop, close: p.closes?.[k.cand.sym] ?? null,
    stopPct: k.stopPct, maxStopPct: k.maxStopPct, roomR: k.roomR, tags: k.tags, live: p.verdicts[`${k.stream}:${k.cand.sym}`] ?? null }));
  const tally               = ['official', 'capwaived', 'comparator'].map((st) => { const t = p.paper?.[st] ?? {}; return { stream: st, orders: t.orders ?? 0, open: t.open ?? 0, pending: t.pending ?? 0, closed: t.closed ?? 0, meanR: typeof t.meanR === 'number' ? t.meanR : null }; });
  return { asOf: p.asOf, light: p.light, lines, tally, notice: PAPER_NOTICE };
}
const sgn = (n        ) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2);
/** The separate nightly Telegram note for the paper test. Sent every night, each pick tagged with its stream, and says plainly it is not for placing. */
export function paperMessage(pt           , maxLines = 10)         {
  const day = new Date(pt.asOf + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const out           = [`Swing PAPER TEST · ${day} · ${pt.light ? pt.light.toUpperCase() + ' light' : 'NO market light'}`, 'Not for placing. These paper trades test whether the stop-width cap and the room rule cost winners (C-53).'];
  const section = (stream             , title        ) => {
    const ls = pt.lines.filter((l) => l.stream === stream);
    out.push('', `${title} (${ls.length})`);
    if (!ls.length) out.push('None tonight.');
    for (const l of ls.slice(0, maxLines)) {
      const lvl = l.kind === 'close' ? `enter at the next close (reference ${l.entry})` : `buy above ${l.entry}${l.close ? ` (${awayText(l.entry, l.close)})` : ''}`;
      out.push(`• ${l.name} (setup ${l.setup}) [${stream}]: ${lvl}, stop ${l.stop}${l.stopPct !== null ? `, ${l.stopPct}% wide` : ''}.${l.live ? ` Live rules: ${l.live}.` : ''}`);
    }
    if (ls.length > maxLines) out.push(`+${ls.length - maxLines} more on the Paper test tab.`);
  };
  section('capwaived', 'CAPWAIVED, buy above a trigger, stop at most 2.5 ATR away');
  section('comparator', 'COMPARATOR, bought at the next close after a signal');
  out.push('', 'So far: ' + pt.tally.map((t) => `${t.stream} ${t.orders} orders${t.meanR !== null ? ` (avg ${sgn(t.meanR)}R)` : ''}`).join(', ') + '.');
  return out.join('\n');
}
