import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES_VERSION } from '../src/engine/settings.ts';

const rules = readFileSync(new URL('../docs/ENGINE_RULES.md', import.meta.url), 'utf8');
test('docs/ENGINE_RULES.md carries the rules version the code implements', () => {
  assert.match(rules, new RegExp('\\*\\*Rules version:\\*\\* ' + RULES_VERSION.replace(/\./g, '\\.')));
});
test('doc copies say which live doc and revision they came from', () => {
  for (const f of ['ENGINE_RULES.md', 'ARCHITECTURE.md']) {
    const t = readFileSync(new URL('../docs/' + f, import.meta.url), 'utf8');
    assert.match(t.split('\n')[0], /doc rev \d+/); assert.match(t.split('\n')[0], /claude\.ai/);
  }
});
test('OQ-8 closed in the rules copy matches the engine: Red setups are 1 and 4', async () => {
  const { LIMITS } = await import('../src/engine/setups.ts');
  assert.equal((rules.match(/\| Red \| 1, 4 \|/g) || []).length, 2);
  assert.deepEqual(LIMITS.india.red.setups, ['1', '4']); assert.deepEqual(LIMITS.us.red.setups, ['1', '4']);
});

// Production code must never reach the old v9 limits table: it exists for replays only.
import { readdirSync as _rd, readFileSync as _rf } from 'node:fs';
test('no src file other than setups.ts references LIMITS_V9', () => {
  const walk = (d: string): string[] => _rd(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  const bad = walk('src').filter((f) => !f.endsWith('src/engine/setups.ts') && _rf(f, 'utf8').includes('LIMITS_V9'));
  assert.deepEqual(bad, []);
});
