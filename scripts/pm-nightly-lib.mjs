// Public data the nightly Portfolio Manager scripts feed into runPipeline (the same inputs the Portfolio page loads), read from the repo's own files. No network, no personal data.
// Used by scripts/sized-shortlist.mjs (Engine Rules C-111). scripts/holding-alerts.mjs still builds its own copy of the price part; it also passes no shortlist, so it labels every stock Legacy.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
export const readJson = J;

/** { data, asOf }: `data` is the PublicData of src/pm/pipeline.ts including the saved nightly shortlists and the near-match numbers, so Swing lots are recognised as they are on the page. */
export function loadPublicData() {
  const bf = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
  const bhav = J('data/india/bhav/' + bf[bf.length - 1]);
  const prices = {}; for (const [s, r] of Object.entries(bhav.rows)) if (r[5] != null) prices[s] = r[5];
  const byDay = {}, hd = 'data/india/prices-hist';
  if (existsSync(hd)) for (const f of readdirSync(hd).filter((x) => /^\d{4}-\d\d\.json$/.test(x))) { const c = J(`${hd}/${f}`); c.dates.forEach((d, i) => { const o = (byDay[d] = {}); for (const [s, a] of Object.entries(c.px)) if (a[i] != null) o[s] = a[i]; }); }
  for (const f of bf) { const o = (byDay[f.slice(0, 10)] = {}); for (const [s, r] of Object.entries(f === bf[bf.length - 1] ? bhav.rows : J('data/india/bhav/' + f).rows)) if (r[5] != null) o[s] = r[5]; }
  const dates = Object.keys(byDay).sort(), px = {};
  dates.forEach((d, i) => { for (const [s, v] of Object.entries(byDay[d])) (px[s] ??= new Array(dates.length).fill(null))[i] = v; });
  const RULE = (f) => (existsSync(`portfolio/rules/${f}.json`) ? `portfolio/rules/${f}.json` : `data/rules/${f}.json`);   // household records live in the private repo; the public file is an empty stub
  // the saved nightly shortlists, assembled as scripts/build-pm-site.mjs does for the page (pm-data/shortlist.json)
  const lines = []; let checked = [], goLive = null; const holidays = [], extra = [];
  if (existsSync('data/india/shortlist')) {
    for (const f of readdirSync('data/india/shortlist').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) { const j = J('data/india/shortlist/' + f); for (const l of j.lines) lines.push({ ...l, signalDate: j.signalDate }); }
    const idx = J('data/india/shortlist/index.json', {}); checked = idx.checked ?? []; goLive = idx.goLive ?? null;
  }
  if (existsSync('data/calendar')) for (const f of readdirSync('data/calendar').filter((x) => /^markets-\d{4}\.json$/.test(x))) { const c = J('data/calendar/' + f).india ?? {}; for (const h of c.holidays ?? []) holidays.push(typeof h === 'string' ? h : h.date); for (const e of c.extraSessions ?? []) extra.push(typeof e === 'string' ? e : e.date); }
  const alloc = J('settings/allocation.json');
  const data = { feed: J('data/india/corp-actions-history.json', []), demergers: J(RULE('demergers')).records, ipos: J(RULE('ipos')).records, amfi: J('data/rules/amfi-schemes.json').rows, fundOverrides: J(RULE('fund-overrides')).records,
    charges: J('data/rules/charges.json'), taxRules: J('data/rules/tax.json'), divRules: J('data/rules/dividend.json'), prices, pricesAsOf: bhav.date ?? bf[bf.length - 1].slice(0, 10), priceHistory: { dates, px },
    shortlist: lines.length && alloc.swingMatch ? { lines, match: alloc.swingMatch, holidays: holidays.filter(Boolean), extra: extra.filter(Boolean), checked, liveFrom: goLive } : undefined };
  return { data, alloc, asOf: dates[dates.length - 1] };
}
