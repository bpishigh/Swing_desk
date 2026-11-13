// Batch A replay prerequisite (claude/batch-a-fundamentals-rules-draft.md, Replay): of the liquid names in the daily price files that later vanished, what share has filings in the store, by the year they were last seen.
// A name is "liquid" if its median daily traded value over its last 60 sessions was at least Rs 5 crore. "Vanished" = last seen more than 10 sessions before the latest file.
// Read-only. Usage: node scripts/survivorship-filings.mjs [--out=data/india/survivorship-filings.json]
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const OUT = arg('out', 'data/india/survivorship-filings.json');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
// Not a company: rights entitlements (-RE, -RE1, -E1) and exchange-traded funds recognised by name. A pattern, so a fund with an unusual ticker can slip through; the missing list is kept in the output to read.
const isCo = (s) => !/-(RE\d?|E1|W\d)$/.test(s) && !/ETF|BEES|GOLD|SILVER|LIQUID|NIFTY|SENSEX|^N\d+$|^IVZIN|^MON\d|^LTGILT/.test(s);
const days = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) days.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) days.push(JSON.parse(readFileSync('data/india/bhav/' + f, 'utf8')));
days.sort((a, b) => (a.date < b.date ? -1 : 1));
const dd = days.filter((d, i) => i === 0 || d.date !== days[i - 1].date), n = dd.length;
const seen = new Map();   // sym -> {last, tv:[recent traded values]}
dd.forEach((d, i) => { for (const [s, r] of Object.entries(d.rows)) { if (!(r[5] > 0)) continue; const v = r[5] * (r[6] || 0); let o = seen.get(s); if (!o) seen.set(s, (o = { last: i, tv: [] })); o.last = i; o.tv.push(v); if (o.tv.length > 60) o.tv.shift(); } });
const ents = JSON.parse(readFileSync('data/india/entities.json', 'utf8')).entities, bySym = new Map();
for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push(e.id); bySym.set(u.symbol, a); }
const hasFilings = (sym) => (bySym.get(sym) || []).some((id) => existsSync(`data/india/filings/${id}.json.gz`));
const med = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const byYear = {};
for (const [s, o] of seen) {
  if (!isCo(s)) continue;
  if (n - 1 - o.last <= 10) continue;                       // still trading
  if (med(o.tv) < 5e7) continue;                            // not liquid (Rs 5 crore, values are in rupees)
  const y = dd[o.last].date.slice(0, 4), b = (byYear[y] ??= { vanished: 0, withFilings: 0, missing: [] });
  b.vanished++; if (hasFilings(s)) b.withFilings++; else if (b.missing.length < 40) b.missing.push(s);
}
for (const b of Object.values(byYear)) b.share = b.vanished ? Math.round((b.withFilings / b.vanished) * 1000) / 1000 : null;
// the same for names still trading, as the reference
let alive = 0, aliveWith = 0; for (const [s, o] of seen) { if (!isCo(s) || n - 1 - o.last > 10 || med(o.tv) < 5e7) continue; alive++; if (hasFilings(s)) aliveWith++; }
const out = { asOf: dd[n - 1].date, note: 'Liquid = median traded value of the last 60 sessions at least Rs 5 crore. Vanished = last seen more than 10 sessions before asOf. Price files start 2020. Rights entitlements and obvious exchange-traded funds are left out by ticker pattern.', byYear, stillTrading: { liquid: alive, withFilings: aliveWith, share: Math.round((aliveWith / alive) * 1000) / 1000 } };
writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log(JSON.stringify({ byYear: Object.fromEntries(Object.entries(byYear).map(([y, b]) => [y, `${b.withFilings}/${b.vanished} (${b.share})`])), stillTrading: out.stillTrading }));
