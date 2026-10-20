import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// build-pm-site.mjs merges two NSE feeds for the next results date: the fresher event calendar wins; disagreements are listed under `differs`.
// The script reads fixed repo paths, so the test swaps the two input files and the output, then puts everything back.
test('event calendar date wins over the board-meeting date; names only in the calendar are added; past dates are ignored', () => {
  const paths = ['data/india/results-dates.json', 'data/india/scan/results-calendar.json', 'site/pm-data/results-next.json'];
  const keep = paths.map((p) => (existsSync(p) ? readFileSync(p, 'utf8') : null));
  const from = JSON.parse(keep[2] as string).asOf as string;
  const day = (n: number) => new Date(Date.parse(from) + n * 864e5).toISOString().slice(0, 10);
  try {
    writeFileSync(paths[0], JSON.stringify({ fetchedAt: 'x', dates: { AAA: [day(5)], BBB: [day(6)], CCC: [day(-3)] } }));
    writeFileSync(paths[1], JSON.stringify({ asOf: from, dates: { AAA: day(7), DDD: day(2), EEE: day(-2) } }));
    execFileSync('node', ['scripts/build-pm-site.mjs'], { stdio: 'pipe' });
    const o = JSON.parse(readFileSync(paths[2], 'utf8'));
    assert.equal(o.next.AAA, day(7)); assert.deepEqual(o.differs.AAA, [day(7), day(5)]);
    assert.equal(o.next.BBB, day(6)); assert.equal(o.next.DDD, day(2));
    assert.equal(o.next.CCC, undefined); assert.equal(o.next.EEE, undefined);
  } finally {
    paths.forEach((p, i) => { if (keep[i] === null) rmSync(p, { force: true }); else writeFileSync(p, keep[i] as string); });
  }
});
