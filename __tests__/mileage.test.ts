import { localDateKey } from '../lib/format';
import { milesByDay, plannedMiles, weekDays } from '../lib/mileage';
import { mondayOf, planWeekOf } from '../lib/training';

// Run with TZ=America/Chicago as well: weeks must not slide across the
// November clock change, and dates must be Birmingham's, not London's.

describe('mondayOf', () => {
  it('finds the Monday of the week, Sunday included', () => {
    expect(localDateKey(mondayOf(new Date(2026, 9, 2, 21, 30)))).toBe('2026-09-28'); // Fri night
    expect(localDateKey(mondayOf(new Date(2026, 9, 4, 23, 59)))).toBe('2026-09-28'); // Sunday
    expect(localDateKey(mondayOf(new Date(2026, 9, 5, 0, 1)))).toBe('2026-10-05'); // Monday
  });
});

describe('weekDays', () => {
  it('runs Monday to Sunday across the clock change', () => {
    const keys = weekDays(new Date(2026, 10, 2)).map(localDateKey);
    expect(keys).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
    const before = weekDays(new Date(2026, 9, 26)).map(localDateKey);
    expect(before[6]).toBe('2026-11-01');
  });
});

describe('milesByDay', () => {
  const monday = new Date(2026, 8, 28);

  it('adds two runs on one day and places each on its day', () => {
    expect(
      milesByDay(
        [
          { logged_on: '2026-09-28', distance_miles: 3 },
          { logged_on: '2026-09-30', distance_miles: '4.5' },
          { logged_on: '2026-09-30', distance_miles: 1.2 },
          { logged_on: '2026-10-04', distance_miles: 8 },
        ],
        monday
      )
    ).toEqual([3, 0, 5.7, 0, 0, 0, 8]);
  });

  it('ignores other weeks and runs logged without a distance', () => {
    expect(
      milesByDay(
        [
          { logged_on: '2026-09-27', distance_miles: 5 },
          { logged_on: '2026-10-05', distance_miles: 5 },
          { logged_on: '2026-09-29', distance_miles: null },
        ],
        monday
      )
    ).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('does not show floating point noise', () => {
    const days = milesByDay(
      [
        { logged_on: '2026-09-28', distance_miles: 0.1 },
        { logged_on: '2026-09-28', distance_miles: 0.2 },
      ],
      monday
    );
    expect(days[0]).toBe(0.3);
  });
});

describe('plannedMiles', () => {
  it('sums singles and ranges into a range', () => {
    expect(
      plannedMiles([
        { distance_miles: 4, distance_miles_max: 6 },
        { distance_miles: '3', distance_miles_max: null },
        { distance_miles: null, distance_miles_max: null },
      ])
    ).toEqual({ min: 7, max: 9 });
  });

  it('is null for a week with no distances', () => {
    expect(plannedMiles([])).toBeNull();
    expect(plannedMiles([{ distance_miles: null, distance_miles_max: null }])).toBeNull();
  });
});

describe('planWeekOf', () => {
  it('counts calendar weeks from the plan start', () => {
    // Plan starts Wednesday Sep 30; its week 1 is the week of Monday Sep 28.
    expect(planWeekOf('2026-09-30', new Date(2026, 8, 28))).toBe(1);
    expect(planWeekOf('2026-09-30', new Date(2026, 9, 4))).toBe(1);
    expect(planWeekOf('2026-09-30', new Date(2026, 9, 5))).toBe(2);
    expect(planWeekOf('2026-09-30', new Date(2026, 10, 9))).toBe(7); // after the clock change
  });

  it('is null before the plan starts, rather than borrowing week 1', () => {
    expect(planWeekOf('2026-09-30', new Date(2026, 8, 27))).toBeNull();
  });
});

describe('localDateKey', () => {
  it('uses the local date, not the London one', () => {
    expect(localDateKey(new Date(2026, 9, 2, 22, 45))).toBe('2026-10-02');
  });
});
