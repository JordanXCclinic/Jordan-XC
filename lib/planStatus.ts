import { mondayOf, planWeekOf } from './training';

/**
 * Whether a plan's coming week is written, for the coach's list of plans.
 *
 * A week is ready once all seven days have something on them: a workout or a
 * rest day (0033). Nothing on any day is not written; anything in between is
 * partly written.
 */
export type NextWeekStatus =
  /** The plan has no start date, so it has no calendar weeks yet. */
  | { kind: 'no-start' }
  /** Next week comes before the plan starts. */
  | { kind: 'later' }
  | {
      kind: 'week';
      /** The plan's week number for next week. */
      week: number;
      /** Next week's Monday. */
      monday: Date;
      /** Days of next week with a workout or rest day on them, 0 to 7. */
      filled: number;
      state: 'ready' | 'partial' | 'empty';
    };

export function nextWeekStatus(
  startsOn: string | null,
  workouts: { week_number: number; day_of_week: number }[],
  today: Date = new Date()
): NextWeekStatus {
  if (!startsOn) return { kind: 'no-start' };
  const monday = mondayOf(today);
  monday.setDate(monday.getDate() + 7);
  const week = planWeekOf(startsOn, monday);
  if (week === null) return { kind: 'later' };

  const days = new Set(
    workouts.filter((w) => w.week_number === week && w.day_of_week >= 1 && w.day_of_week <= 7).map((w) => w.day_of_week)
  );
  const filled = days.size;
  return {
    kind: 'week',
    week,
    monday,
    filled,
    state: filled >= 7 ? 'ready' : filled === 0 ? 'empty' : 'partial',
  };
}
