import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNasdaqEarnings, indiaResultDates, earnNote } from '../src/ingest/earnings.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
test('reads the Nasdaq estimate', () => {
  const r = parseNasdaqEarnings({ data: { reportText: 'ExxonMobil Holdings Corporation Common Stock is estimated to report earnings on  10/30/2026. The upcoming...' } });
  assert.deepEqual(r, { date: '2026-10-30', estimated: true });
  assert.equal(parseNasdaqEarnings({ data: null }).date, null);
});
test('NSE calendar keeps the nearest future financial-results meeting', () => {
  const m = indiaResultDates([{ symbol: 'A', purpose: 'Financial Results', date: '19-Oct-2026' }, { symbol: 'A', purpose: 'Financial Results/Other business matters', date: '05-Nov-2026' }, { symbol: 'A', purpose: 'Financial Results', date: '01-Oct-2026' }, { symbol: 'B', purpose: 'Dividend', date: '20-Oct-2026' }], '2026-10-17');
  assert.equal(m.get('A'), '2026-10-19'); assert.equal(m.has('B'), false);
});
test('flags results inside the 10-session window', () => {
  const cal = makeCalendar([]);
  assert.equal(earnNote('2026-10-23', '2026-10-16', cal.sessionsBetween.bind(cal)).inWindow, true);
  assert.equal(earnNote('2026-11-20', '2026-10-16', cal.sessionsBetween.bind(cal)).inWindow, false);
  assert.equal(earnNote(null, '2026-10-16', cal.sessionsBetween.bind(cal)).inWindow, null);
});
