// One-off count (C-5 step 1): how many names on each surveillance list sit in the top 500 / top 200 by 20-session median traded value (Batch A D1 universe). Counting only.
import fs from 'node:fs';
const dir = 'data/india/bhav', files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(-20);
const tv = {}; for (const f of files) { const b = JSON.parse(fs.readFileSync(`${dir}/${f}`)); for (const [s, r] of Object.entries(b.rows)) (tv[s] ??= []).push(r[5] * r[6]); }
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const rank = Object.entries(tv).filter(([, a]) => a.length >= 15).map(([s, a]) => [s, med(a)]).sort((a, b) => b[1] - a[1]).map(([s]) => s);
const t500 = new Set(rank.slice(0, 500)), t200 = new Set(rank.slice(0, 200));
const sv = JSON.parse(fs.readFileSync('data/india/surveillance/' + fs.readdirSync('data/india/surveillance').sort().pop()));
const out = { asOf: files.at(-1), sessions: files.length, ranked: rank.length, lists: {} };
for (const k of ['asmLong', 'asmShort', 'gsm', 'esm']) { const sy = sv[k].map((r) => r.symbol); out.lists[k] = { listed: sy.length, top500: sy.filter((s) => t500.has(s)).map((s) => s), top200: sy.filter((s) => t200.has(s)).length }; out.lists[k].top500n = out.lists[k].top500.length; }
const any = new Set(Object.values(out.lists).flatMap((l) => l.top500)); out.anyTop500 = any.size;
console.log(JSON.stringify(out, null, 1));
