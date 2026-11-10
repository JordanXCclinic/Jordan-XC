import { summarizeWeek } from '../lib/insights';

const monday = new Date(2026, 10, 9);
const today = new Date(2026, 10, 11, 15, 0); // Wednesday afternoon

const workout = (id: string, week: number, day: number, miles: number | null) => ({
  id,
  week_number: week,
  day_of_week: day,
  distance_miles: miles,
  distance_miles_max: null,
});

const run = (
  id: string,
  on: string,
  miles: number | string | null,
  seconds: number | null,
  effort: number | null,
  workoutId: string | null = null
) => ({
  id,
  workout_id: workoutId,
  logged_on: on,
  distance_miles: miles,
  duration_seconds: seconds,
  effort,
});

const workouts = [
  workout('mon', 3, 1, 4),
  workout('tue', 3, 2, 5),
  workout('wed', 3, 3, 4),
  workout('sat', 3, 6, 8),
  workout('other-week', 2, 1, 4),
];

describe('summarizeWeek', () => {
  it('marks each day done, missed, upcoming or rest against today', () => {
    const week = summarizeWeek({
      monday,
      today,
      planWeek: 3,
      workouts,
      runs: [run('a', '2026-11-09', 4, 2100, 5, 'mon')],
    });
    expect(week.days.map((day) => day.status)).toEqual([
      'done', // Mon: logged
      'missed', // Tue: planned, gone, nothing logged
      'upcoming', // Wed: today, not logged yet
      'rest',
      'rest',
      'upcoming', // Sat
      'rest',
    ]);
    // Monday and Tuesday have come; today's run is not yet owed.
    expect(week.due).toBe(2);
    expect(week.done).toBe(1);
    expect(week.planned).toEqual({ min: 21, max: 21 });
  });

  it('adds up miles, effort and pace across every run, extra runs too', () => {
    const week = summarizeWeek({
      monday,
      today,
      planWeek: 3,
      workouts,
      runs: [
        run('a', '2026-11-09', 4, 2000, 5, 'mon'),
        run('b', '2026-11-09', '2', 1000, 8), // an extra run, as a string
        run('c', '2026-11-10', 5, null, null, 'tue'), // no time: miles but no pace
        run('d', '2026-11-12', null, 1800, 6), // no distance: time but no pace
      ],
    });
    expect(week.miles).toBe(11);
    expect(week.days[0]!.miles).toBe(6);
    expect(week.effort).toBe(6.3);
    expect(week.pacedMiles).toBe(6);
    expect(week.seconds).toBe(3000);
    expect(week.done).toBe(2);
  });

  it('counts a workout logged on another day as done', () => {
    const week = summarizeWeek({
      monday,
      today: new Date(2026, 10, 16),
      planWeek: 3,
      workouts,
      runs: [run('a', '2026-11-15', 8, 4200, 6, 'sat')],
    });
    expect(week.days[5]!.status).toBe('done');
    expect(week.days[6]!.status).toBe('done');
    expect(week.done).toBe(1);
  });

  it('shows runs with no plan for a week outside it', () => {
    const week = summarizeWeek({
      monday,
      today,
      planWeek: null,
      workouts,
      runs: [run('a', '2026-11-10', 3, 1500, 4)],
    });
    expect(week.planned).toBeNull();
    expect(week.days[1]!.status).toBe('done');
    expect(week.days.every((day) => day.workout === null)).toBe(true);
    expect(week.due).toBe(0);
  });
});
