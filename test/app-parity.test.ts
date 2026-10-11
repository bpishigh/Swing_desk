import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { analyze, type TrackerRow } from '../src/engine/regime.ts';
import { LIMITS } from '../src/engine/setups.ts';

// The patched app (v9.1) must give the same regime numbers as the engine's default rules (R-2026.10.5), so the Claude desk and the
// GitHub engine cannot drift. The app copy is the file published to the live desk.
const html = readFileSync('fixtures/app/swing-desk-v9.1.html', 'utf8');
const line = (re: RegExp) => html.match(re)![0];
const grab = (a: RegExp, b: RegExp) => { const i = html.search(a); const r = html.slice(i); return r.slice(0, r.search(b)); };
const code = [
  line(/const num = [^\n]+/), line(/const ok = [^\n]+/), line(/const parseD = [^\n]+/),
  grab(/function weekdaysBetween/, /\nconst daysBetween/),
  grab(/function chg\(r,p\)/, /function analyze\(rows\)/), grab(/function analyze\(rows\)/, /function regimeFrom\(rows\)/),
].join('\n');
const ctx: any = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.analyze=analyze;', ctx);
const appAnalyze = (rows: TrackerRow[]) => ctx.analyze(JSON.parse(JSON.stringify(rows)));

function same(rows: TrackerRow[], label: string) {
  for (let i = 1; i <= rows.length; i++) {
    if (i < rows.length - 40 && i % 5 !== 0) continue; // every 5th early prefix, every one of the last 40
    const a = appAnalyze(rows.slice(0, i)), e = analyze(rows.slice(0, i));
    const d = rows[i - 1].date;
    assert.equal(a.active.length, e.active.length, `${label} ${d} active`);
    assert.equal(a.expiredEarly.length, e.expiredEarly.length, `${label} ${d} expired`);
    assert.equal(a.status, e.status, `${label} ${d} status`);
    assert.equal(a.ftd?.date ?? null, e.ftd?.date ?? null, `${label} ${d} ftd date`);
    assert.equal(a.ftd?.rallyLow ?? null, e.ftd?.rallyLow ?? null, `${label} ${d} rally low`);
    assert.equal(a.since, e.since, `${label} ${d} since`);
  }
}
const load = (dir: string): TrackerRow[] => readdirSync(dir).filter((f) => f.endsWith('.json'))
  .map((f) => ({ date: f.slice(0, -5), ...JSON.parse(readFileSync(dir + f, 'utf8')) }) as TrackerRow).sort((a, b) => a.date.localeCompare(b.date));
test('app v9.1 vs engine: recorded India and US tracker rows, every prefix', () => { same(load('fixtures/db/tracker/'), 'india'); same(load('fixtures/db/us_tracker/'), 'us'); });

const nextWd = (d: string) => { const x = new Date(d + 'T00:00:00Z'); do { x.setUTCDate(x.getUTCDate() + 1); } while ([0, 6].includes(x.getUTCDay())); return x.toISOString().slice(0, 10); };
function build(moves: { pct: number; vol: number; breadth?: number; skip?: boolean }[], first = 100): TrackerRow[] {
  const rows: TrackerRow[] = []; let c = first, d = '2025-01-02'; const closes: number[] = [];
  moves.forEach((m, i) => {
    const prev = c; c = c * (1 + m.pct / 100); closes.push(c);
    const avg = (w: number) => (i >= w ? closes.slice(i - w, i).reduce((a, b) => a + b, 0) / w : undefined);
    rows.push({ date: d, close: c, high: Math.max(prev, c) * 1.001, low: Math.min(prev, c) * 0.999, volume: m.vol, sma50: avg(50), sma200: avg(200), breadth: m.breadth, skip: m.skip });
    d = nextWd(d);
  });
  return rows;
}
const up = (n: number) => Array.from({ length: n }, (_, i) => ({ pct: 0.3, vol: 100 + (i % 7), breadth: 65 }));
const fall = (n: number, p = -1.2) => Array.from({ length: n }, () => ({ pct: p, vol: 90, breadth: 30 }));
const rally = [{ pct: 2.0, vol: 95, breadth: 30 }, { pct: 0.4, vol: 96, breadth: 30 }, { pct: 0.3, vol: 97, breadth: 30 }, { pct: 1.6, vol: 130, breadth: 30 }];
test('app v9.1 vs engine: synthetic corrections (slow slide, fast 8% drop, recovery, failed rally, skip days)', () => {
  same(build([...up(12), { pct: 1.5, vol: 400, breadth: 65 }, ...up(250), ...fall(40)]), 'stale-ftd');
  same(build([...up(260), ...fall(40), ...rally]), 'slow-slide');
  same(build([...up(260), ...fall(10, -1.0), ...rally]), 'fast-drop');
  same(build([...up(260), ...fall(40), ...rally, ...Array.from({ length: 120 }, () => ({ pct: 0.9, vol: 100, breadth: 70 }))]), 'recovery');
  same(build([...up(260), ...fall(40), ...rally, { pct: -3, vol: 100, breadth: 30 }, ...up(20)]), 'failed-rally');
  same(build([...up(30), { pct: 0.5, vol: 300, skip: true }, { pct: -0.5, vol: 120 }, ...up(5), { pct: -0.4, vol: 301, skip: true }, { pct: -0.6, vol: 150 }]), 'skip-baseline');
});
test('app v9.1 limits and wording match the Engine Rules', () => {
  const lim = (name: string) => { const m = html.match(new RegExp(name + ' = \\{[\\s\\S]*?red:\\{setups:(\\[[^\\]]*\\])')); return JSON.parse(m![1]); };
  assert.deepEqual(lim('const LIMITS'), LIMITS.india.red.setups); assert.deepEqual(lim('const LIMITS_US'), LIMITS.us.red.setups);
  assert.match(html, /isn't allowed in "\+\(L\.name==="red"\?"Red":"Yellow"\)/);
  assert.match(html, /Rules version R-2026\.10\.5/);
});
