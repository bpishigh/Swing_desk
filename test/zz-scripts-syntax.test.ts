// Every script must at least parse. A comment that swallowed a closing "};" in paper-book-india.mjs (C-113, 30 Oct) went unnoticed
// for a week because nothing imported the file: the India nightly step died and the momentum book never started.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const SKIP = new Set(['probe-india-oldbhav.mjs']);   // one-off probe, already broken before this check existed
test('every scripts/*.mjs parses', () => {
  const bad = readdirSync('scripts').filter((f) => f.endsWith('.mjs') && !SKIP.has(f)).filter((f) => spawnSync(process.execPath, ['--check', 'scripts/' + f]).status !== 0);
  assert.deepEqual(bad, []);
});
