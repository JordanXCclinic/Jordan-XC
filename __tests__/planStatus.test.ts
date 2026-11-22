import { localDateKey } from '../lib/format';
import { nextWeekStatus } from '../lib/planStatus';

// Sunday 22 November 2026: next week is Monday the 23rd.
const today = new Date(2026, 10, 22, 15, 0);
const day = (week_number: number, day_of_week: number) => ({ week_number, day_of_week });

describe('nextWeekStatus', () => {
  it('is ready once all seven days of next week are written, rest days included', () => {
    const status = nextWeekStatus('2026-11-09', [1, 2, 3, 4, 5, 6, 7].map((d) => day(3, d)), today);
    expect(status).toMatchObject({ kind: 'week', week: 3, filled: 7, state: 'ready' });
    if (status.kind === 'week') expect(localDateKey(status.monday)).toBe('2026-11-23');
  });

  it('is partly written with some days, and empty with none', () => {
    expect(nextWeekStatus('2026-11-09', [day(3, 1), day(3, 3), day(2, 2)], today)).toMatchObject({
      state: 'partial',
      filled: 2,
    });
    // Only this week is written: next week is still empty.
    expect(nextWeekStatus('2026-11-09', [1, 2, 3, 4, 5, 6, 7].map((d) => day(2, d)), today)).toMatchObject({
      state: 'empty',
      filled: 0,
    });
  });

  it('counts a day once, even with two entries for it', () => {
    expect(nextWeekStatus('2026-11-09', [day(3, 1), day(3, 1)], today)).toMatchObject({ filled: 1 });
  });

  it('looks at week 1 when the plan starts next week, and says so when it starts later', () => {
    expect(nextWeekStatus('2026-11-23', [day(1, 1)], today)).toMatchObject({ kind: 'week', week: 1 });
    expect(nextWeekStatus('2026-12-07', [], today)).toEqual({ kind: 'later' });
    expect(nextWeekStatus(null, [], today)).toEqual({ kind: 'no-start' });
  });

  it('on a Monday, means the week after this one', () => {
    const monday = new Date(2026, 10, 23, 9, 0);
    expect(nextWeekStatus('2026-11-09', [day(4, 1)], monday)).toMatchObject({ week: 4, filled: 1 });
  });
});
