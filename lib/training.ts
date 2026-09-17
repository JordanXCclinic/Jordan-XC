import { parseLocalDateTime } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plans are keyed Monday=1 through Sunday=7; JavaScript counts Sunday=0. */
export function planDayToday(date: Date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Which week of a plan a date falls in, counting from the assignment's start.
 * Week 1 is the week the plan starts; anything before it is also week 1, so an
 * athlete who opens the app early sees the first week rather than nothing.
 */
export function currentWeekNumber(startsOn: string, today: Date = new Date()): number {
  const start = parseLocalDateTime(startsOn, '00:00');
  if (!start) return 1;

  // Count from the Monday of the starting week so weeks line up with the
  // calendar rather than sliding by whichever weekday the plan began on.
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - (planDayToday(start) - 1));
  startMonday.setHours(0, 0, 0, 0);

  const reference = new Date(today);
  reference.setHours(0, 0, 0, 0);

  const weeks = Math.floor((reference.getTime() - startMonday.getTime()) / (7 * DAY_MS));
  return Math.max(1, weeks + 1);
}
