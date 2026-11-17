// India IPO ticker list (owner, 18 Nov 2026: "a separate IPO base ... a separate list of tickers updating every time there is an IPO"). Output only; changes no rule.
// A listing is the first session an EQ-series symbol appears in the stored daily files (data/india/bhav-hist then data/india/bhav) after 2 Jan 2020, never seen before, and not a symbol change
// (entity table: an entity that already traded under an earlier symbol is a rename). Sessions after the entity table's date cannot be checked and are marked unverified.
// A day with more than 20 first appearances is dropped as a mass migration. Known limits: SME names are absent (the stored files keep EQ and BE only); relistings, demergers and series moves from BE to EQ can look like listings; listing date = first stored session, not the allotment date.
// Writes data/india/ipo/list.json {asOf, rows:[{sym, listed, firstClose, verified}]}. Run nightly after the stock files.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const days = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) days.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) days.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
days.sort((a, b) => (a.date < b.date ? -1 : 1));
const ent = existsSync('data/india/entities.json') ? JSON.parse(readFileSync('data/india/entities.json', 'utf8')) : { entities: [], asOf: '0000' };
const earlier = new Map();   // symbol -> true when its entity traded under an earlier symbol
for (const e of ent.entities) if (e.symbols.length > 1) for (let i = 1; i < e.symbols.length; i++) earlier.set(e.symbols[i].symbol, true);
const seen = new Set(Object.keys(days[0].rows)), first = new Map(), seenDates = new Set();
for (let i = 1; i < days.length; i++) {
  const d = days[i]; if (seenDates.has(d.date)) continue; seenDates.add(d.date);
  for (const [sym, r] of Object.entries(d.rows)) { if (seen.has(sym)) continue; seen.add(sym); if (r[0] === 'EQ' && r[5] > 0 && d.date >= '2020-01-02') first.set(sym, { sym, listed: d.date, firstClose: r[5] }); }
}
const perDay = new Map(); for (const x of first.values()) perDay.set(x.listed, (perDay.get(x.listed) ?? 0) + 1);
const bulk = new Set([...perDay].filter(([, n]) => n > 20).map(([d]) => d));   // a day with more than 20 first appearances is a mass move (for example SME names moving to the main board), not IPOs
const rows = [...first.values()].filter((x) => !bulk.has(x.listed)).filter((x) => !earlier.get(x.sym)).map((x) => ({ ...x, verified: x.listed <= ent.asOf })).sort((a, b) => (a.listed < b.listed ? 1 : -1));
mkdirSync('data/india/ipo', { recursive: true });
writeFileSync('data/india/ipo/list.json', JSON.stringify({ asOf: days.at(-1).date, count: rows.length, unverified: rows.filter((r) => !r.verified).length, rows }) + '\n');
console.log(`mass-move days dropped: ${[...bulk].join(', ') || 'none'}`);
console.log(`ipo list: ${rows.length} listings since 2020 (${rows.filter((r) => !r.verified).length} not yet checked against the entity table), latest ${rows[0]?.sym} ${rows[0]?.listed}`);
