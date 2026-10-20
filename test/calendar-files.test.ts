import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeCalendars, loadCalendarFiles, calendarAlert } from '../src/engine/calendar-files.ts';

test('the merged calendar of the one 2026 file is that file', () => {
  const f = JSON.parse(readFileSync('data/calendar/markets-2026.json', 'utf8')), m = loadCalendarFiles();
  assert.deepEqual(m.india.holidays, [...f.india.holidays].sort()); assert.deepEqual(m.us.holidays, [...f.us.holidays].sort());
  assert.deepEqual((m.india as any).priorHolidays, [...f.india.priorHolidays].sort()); assert.deepEqual(m.years, [2026]);
});
test('a second year adds its holidays; lists are unions, notes come from the latest year', () => {
  const m = mergeCalendars([
    { year: 2027, data: { note: 'n27', india: { holidays: ['2027-01-26'], priorHolidaysNote: 'b' }, us: { holidays: ['2027-01-01'] } } },
    { year: 2026, data: { note: 'n26', india: { holidays: ['2026-10-02'], priorHolidays: ['2025-12-25'], priorHolidaysNote: 'a' }, us: { holidays: ['2026-12-25'] } } },
  ]);
  assert.deepEqual(m.india.holidays, ['2026-10-02', '2027-01-26']); assert.deepEqual(m.us.holidays, ['2026-12-25', '2027-01-01']);
  assert.equal((m.india as any).priorHolidaysNote, 'b'); assert.deepEqual((m.india as any).priorHolidays, ['2025-12-25']); assert.equal(m.note, 'n27');
});
test('alert: silent while the current year and (from December) the next year are covered; says what is missing otherwise', () => {
  assert.equal(calendarAlert('2026-10-20', [2026]), null);
  assert.equal(calendarAlert('2026-11-30', [2026]), null);
  assert.match(calendarAlert('2026-12-01', [2026]) as string, /2027/);
  assert.equal(calendarAlert('2026-12-01', [2026, 2027]), null);
  assert.match(calendarAlert('2027-01-02', [2026]) as string, /2027/);
});
