import { parseLocalDateTime } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plans are keyed Monday=1 through Sunday=7; JavaScript counts Sunday=0. */
export function planDayToday(date: Date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function midnight(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * The Monday of the week a plan starts in, which is where week 1's Monday
 * falls. Weeks are counted from here so they line up with the calendar rather
 * than sliding by whichever weekday the plan began on.
 */
function startMonday(startsOn: string): Date | null {
  const start = parseLocalDateTime(startsOn, '00:00');
  if (!start) return null;
  const monday = new Date(start);
  monday.setDate(start.getDate() - (planDayToday(start) - 1));
  return midnight(monday);
}

/**
 * Whole days from one midnight to another. Rounded rather than floored: a week
 * that contains the spring clock change is an hour short, and flooring it
 * counted the following Monday as still being the week before.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / DAY_MS);
}

/**
 * Which week of a plan a date falls in, counting from the assignment's start.
 * Week 1 is the week the plan starts; anything before it is also week 1, so an
 * athlete who opens the app early sees the first week rather than nothing.
 *
 * That makes it the week to *show*, not a claim about today — before the plan
 * starts there is no today in it. Use planPositionToday for that.
 */
export function currentWeekNumber(startsOn: string, today: Date = new Date()): number {
  const monday = startMonday(startsOn);
  if (!monday) return 1;
  return Math.max(1, Math.floor(daysBetween(monday, today) / 7) + 1);
}

/** The calendar date a workout falls on, for a plan that starts on startsOn. */
export function workoutDate(startsOn: string, week: number, day: number): Date | null {
  const monday = startMonday(startsOn);
  if (!monday) return null;
  // setDate rather than adding milliseconds, so a clock change cannot move it.
  const date = new Date(monday);
  date.setDate(monday.getDate() + (week - 1) * 7 + (day - 1));
  return date;
}

/**
 * Where today falls in the plan, or null if the plan has not started yet.
 *
 * Without this, a plan starting next June put a "Today" on a week-one workout
 * every day of the autumn, because the week to show and the week it actually
 * is were the same number.
 */
export function planPositionToday(
  startsOn: string,
  today: Date = new Date()
): { week: number; day: number } | null {
  const start = parseLocalDateTime(startsOn, '00:00');
  if (!start || midnight(today) < midnight(start)) return null;
  return { week: currentWeekNumber(startsOn, today), day: planDayToday(today) };
}

/** Midnight on the Monday of the week a date falls in. Weeks run Monday to Sunday. */
export function mondayOf(date: Date): Date {
  const monday = midnight(date);
  monday.setDate(monday.getDate() - (planDayToday(monday) - 1));
  return monday;
}

/**
 * Which week of a plan a calendar week is, or null for a week before the plan
 * starts. Unlike currentWeekNumber this does not clamp to week 1: a week with
 * no plan in it must not borrow week 1's mileage as its target.
 */
export function planWeekOf(startsOn: string, date: Date): number | null {
  const monday = startMonday(startsOn);
  if (!monday) return null;
  const week = Math.floor(daysBetween(monday, mondayOf(date)) / 7) + 1;
  return week >= 1 ? week : null;
}
