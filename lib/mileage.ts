import { localDateKey } from './format';

/**
 * Adding up an athlete's own week of running, for the weekly mileage card.
 * Kept apart from the component so the arithmetic can be tested on its own.
 */

/** The seven days of the week starting on this Monday, Monday first. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    // setDate rather than adding milliseconds, so a clock change cannot move it.
    day.setDate(monday.getDate() + index);
    return day;
  });
}

/**
 * Miles run on each day of the week, Monday first. Two runs on one day add up,
 * and a log with no distance (time only) counts as nothing rather than failing.
 */
export function milesByDay(
  logs: { logged_on: string; distance_miles: number | string | null }[],
  monday: Date
): number[] {
  const index = new Map(weekDays(monday).map((day, i) => [localDateKey(day), i]));
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const log of logs) {
    const i = index.get(log.logged_on);
    if (i === undefined || log.distance_miles === null) continue;
    // numeric columns can arrive as strings from PostgREST.
    const miles = Number(log.distance_miles);
    if (Number.isFinite(miles) && miles > 0) totals[i]! += miles;
  }
  return totals.map(round2);
}

/**
 * The miles a plan sets for one week, as a range when any workout has one.
 * Null when the week has no distances in it at all, so the card shows a total
 * on its own rather than a target of zero.
 */
export function plannedMiles(
  workouts: { distance_miles: number | string | null; distance_miles_max: number | string | null }[]
): { min: number; max: number } | null {
  let min = 0;
  let max = 0;
  let any = false;
  for (const workout of workouts) {
    if (workout.distance_miles === null) continue;
    const near = Number(workout.distance_miles);
    if (!Number.isFinite(near)) continue;
    const far = workout.distance_miles_max === null ? near : Number(workout.distance_miles_max);
    min += near;
    max += Number.isFinite(far) && far > near ? far : near;
    any = true;
  }
  return any ? { min: round2(min), max: round2(max) } : null;
}

export const round2 = (value: number): number => Math.round(value * 100) / 100;
