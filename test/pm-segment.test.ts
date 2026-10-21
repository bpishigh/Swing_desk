import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndexList } from '../src/ingest/segments.ts';
import { segmentOf } from '../src/pm/segment.ts';
const csv = (n: number, pre: string) => 'Company Name,Industry,Symbol,Series,ISIN Code\n' + Array.from({ length: n }, (_, i) => `Co ${i},Fin,${pre}${i},EQ,INE${i}`).join('\n') + '\n';
test('an NSE list is read by symbol; a changed header or implausible count is refused', () => {
  assert.equal(parseIndexList(csv(100, 'L'), 'large').length, 100);
  assert.equal(parseIndexList('\uFEFF' + csv(150, 'M'), 'mid')[0], 'M0');
  assert.throws(() => parseIndexList('Name,Symbol\nA,B\n', 'large'), /header/);
  assert.throws(() => parseIndexList(csv(20, 'L'), 'large'), /expected 90 to 110/);
});
test('segment of a stock: large, mid, small, or none when outside the lists or the lists are absent', () => {
  const s = { fetchedAt: 'x', large: ['RELIANCE'], mid: ['MIDCO'], small: ['SMLCO'] };
  assert.deepEqual(['RELIANCE', 'MIDCO', 'SMLCO', 'OTHER'].map((x) => segmentOf(x, s)), ['Large', 'Mid', 'Small', null]);
  assert.equal(segmentOf('RELIANCE', null), null);
});
test('industry of each symbol comes from the second column', async () => {
  const { parseIndexIndustries } = await import('../src/ingest/segments.ts');
  assert.deepEqual(parseIndexIndustries('Company Name,Industry,Symbol,Series,ISIN Code\nA Ltd,Financial Services,AAA,EQ,INE1\nB Ltd,Information Technology,BBB,EQ,INE2\n'), { AAA: 'Financial Services', BBB: 'Information Technology' });
  assert.throws(() => parseIndexIndustries('Name,Symbol\nx,y\n'));
});
