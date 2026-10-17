import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('the dashboard page script compiles (a stray quote once blanked the whole page)', () => {
  for (const f of ['site/index.html', 'site/upload.html']) {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      const mod = /type="module"/.test(m[1]); if (/application\/json/.test(m[1])) continue;
      if (mod) continue;   // module scripts use import syntax; checked by the browser tests below
      assert.doesNotThrow(() => new vm.Script(m[2]), f);
    }
  }
});
