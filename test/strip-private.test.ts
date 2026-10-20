import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripPrivate } from '../scripts/strip-private.mjs';
test('private passages are removed and unclosed markers throw', () => {
  assert.equal(stripPrivate('a <!--private-->secret<!--/private--> b'), 'a [removed from the published copy] b');
  assert.throws(() => stripPrivate('a <!--private--> b'));
  assert.throws(() => stripPrivate('a <!--/private--> b'));
});
test('published STATUS carries none of the owner statements', () => {
  const o = stripPrivate(readFileSync('docs/STATUS.md', 'utf8'));
  assert.doesNotMatch(o, /private-->/);
  const src = readFileSync('docs/STATUS.md', 'utf8');
  for (const m of src.matchAll(/<!--private-->([\s\S]*?)<!--\/private-->/g)) assert.ok(!o.includes(m[1].trim().slice(0, 60)), 'private text survives: ' + m[1].slice(0, 40));
  assert.ok(!/no money moved|bank at each/.test(o + readFileSync('settings/allocation.json', 'utf8')));
});
