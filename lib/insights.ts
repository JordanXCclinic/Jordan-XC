import { localDateKey } from './format';
import { plannedMiles, round2, weekDays } from './mileage';

/**
 * One runner's week as a coach reads it on the roster: what the plan asked
 * for each day, what was logged, and the week's totals. Kept apart from the
 * screen so the arithmetic can be tested on its own.
 */

export type InsightRun = {
  id: string;
  workout_id: string | null;
  logged_on: string;
  distance_miles: number | string | null;
  duration_seconds: number | null;
  effort: number | null;
};

export type InsightWorkout = {
  id: string;
  week_number: number;
  day_of_week: number;
  distance_miles: number | string | null;
  distance_miles_max: number | string | null;
};

/**
 * - done: something was logged that day, or against that day's workout.
 * - missed: a workout on a day already gone, with nothing logged for it.
 * - upcoming: a workout today or later, not logged yet.
 * - rest: nothing planned and nothing run.
 */
export type DayStatus = 'done' | 'missed' | 'upcoming' | 'rest';

export type InsightDay<W, R> = {
  date: Date;
  key: string;
  workout: W | null;
  runs: R[];
  miles: number;
  status: DayStatus;
};

export type InsightWeek<W, R> = {
  days: InsightDay<W, R>[];
  miles: number;
  planned: { min: number; max: number } | null;
  /** Workouts whose day has come, or that were logged early. */
  due: number;
  /** Of those, the ones with a run logged. */
  done: number;
  /** Mean effort of the week's runs that have one, to one decimal. */
  effort: number | null;
  /** Total time over total miles, for runs that have both. */
  seconds: number;
  pacedMiles: number;
};

function milesOf(run: { distance_miles: number | string | null }): number {
  const miles = Number(run.distance_miles);
  return run.distance_miles !== null && Number.isFinite(miles) && miles > 0 ? miles : 0;
}

/**
 * @param planWeek the plan's week number for this calendar week, or null for a
 *   week outside the plan (before it starts, or with no plan at all).
 */
export function summarizeWeek<W extends InsightWorkout, R extends InsightRun>({
  monday,
  today,
  planWeek,
  workouts,
  runs,
}: {
  monday: Date;
  today: Date;
  planWeek: number | null;
  workouts: W[];
  runs: R[];
}): InsightWeek<W, R> {
  const todayKey = localDateKey(today);
  const inWeek = planWeek === null ? [] : workouts.filter((w) => w.week_number === planWeek);
  const loggedAgainst = new Set(runs.map((run) => run.workout_id).filter(Boolean));

  let due = 0;
  let done = 0;
  let effortSum = 0;
  let effortCount = 0;
  let seconds = 0;
  let pacedMiles = 0;
  let miles = 0;

  const days = weekDays(monday).map((date, index) => {
    const key = localDateKey(date);
    const workout = inWeek.find((w) => w.day_of_week === index + 1) ?? null;
    const dayRuns = runs.filter((run) => run.logged_on === key);
    const dayMiles = round2(dayRuns.reduce((sum, run) => sum + milesOf(run), 0));

    for (const run of dayRuns) {
      miles += milesOf(run);
      if (run.effort !== null) {
        effortSum += run.effort;
        effortCount += 1;
      }
      if (run.duration_seconds && milesOf(run) > 0) {
        seconds += run.duration_seconds;
        pacedMiles += milesOf(run);
      }
    }

    // A workout counts as done when a run sits on its day, or when a run was
    // logged against it on another day (a Saturday long run done on Sunday).
    const workoutDone = Boolean(workout && (dayRuns.length > 0 || loggedAgainst.has(workout.id)));
    if (workout && (key < todayKey || workoutDone)) due += 1;
    if (workoutDone) done += 1;

    const status: DayStatus =
      dayRuns.length > 0 || workoutDone
        ? 'done'
        : workout
          ? key < todayKey
            ? 'missed'
            : 'upcoming'
          : 'rest';

    return { date, key, workout, runs: dayRuns, miles: dayMiles, status };
  });

  return {
    days,
    miles: round2(miles),
    planned: plannedMiles(inWeek),
    due,
    done,
    effort: effortCount ? Math.round((effortSum / effortCount) * 10) / 10 : null,
    seconds,
    pacedMiles: round2(pacedMiles),
  };
}
