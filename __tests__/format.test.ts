import {
  formatDuration,
  formatMileRange,
  formatMiles,
  formatShortDate,
  parseDuration,
  parseLocalDateTime,
  planDayLabel,
  roleLabel,
} from '../lib/format';
import {
  currentWeekNumber,
  planDayToday,
  planPositionToday,
  workoutDate,
} from '../lib/training';

describe('parseDuration', () => {
  it('reads a time the way a runner writes it', () => {
    expect(parseDuration('18:23')).toBe(1103);
    expect(parseDuration('1:02:33')).toBe(3753);
    expect(parseDuration('45')).toBe(45);
  });

  it('refuses nonsense rather than storing a wrong time', () => {
    // 18:99 is the typo that matters: it looks like a time and is not one.
    expect(parseDuration('18:99')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('1:2:3:4')).toBeNull();
  });

  it('round-trips through the formatter', () => {
    expect(formatDuration(parseDuration('18:23')!)).toBe('18:23');
    expect(formatDuration(parseDuration('1:02:33')!)).toBe('1:02:33');
  });
});

describe('parseLocalDateTime', () => {
  it('builds the date in the device zone, not UTC', () => {
    // `new Date('2026-06-01')` is parsed as UTC and can land on the previous
    // evening, which would move a practice by hours.
    const parsed = parseLocalDateTime('2026-06-01', '07:00')!;
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(1);
    expect(parsed.getHours()).toBe(7);
  });

  it('rejects input it cannot trust', () => {
    expect(parseLocalDateTime('June 1', '07:00')).toBeNull();
    expect(parseLocalDateTime('2026-06-01', '7pm')).toBeNull();
  });
});

describe('training plan weeks', () => {
  it('counts weeks from the Monday of the starting week', () => {
    // A plan starting Wednesday still has that whole week as week 1.
    expect(currentWeekNumber('2026-06-03', new Date(2026, 5, 5))).toBe(1);
    expect(currentWeekNumber('2026-06-03', new Date(2026, 5, 8))).toBe(2);
    expect(currentWeekNumber('2026-06-03', new Date(2026, 5, 15))).toBe(3);
  });

  it('shows week 1 to someone who opens the app early', () => {
    expect(currentWeekNumber('2026-06-03', new Date(2026, 4, 20))).toBe(1);
  });

  it('numbers days Monday first, the way a plan is written', () => {
    expect(planDayToday(new Date(2026, 5, 1))).toBe(1);
    expect(planDayToday(new Date(2026, 5, 7))).toBe(7);
    expect(planDayLabel(1)).toBe('Mon');
    expect(planDayLabel(7)).toBe('Sun');
  });

  it('puts each workout on its calendar date', () => {
    // Starts Monday 7 June 2027: week 1 Monday is that day, week 2 Wednesday
    // is nine days later.
    expect(workoutDate('2027-06-07', 1, 1)).toEqual(new Date(2027, 5, 7));
    expect(workoutDate('2027-06-07', 2, 3)).toEqual(new Date(2027, 5, 16));
    // Starting midweek, week 1 still runs from that week's Monday.
    expect(workoutDate('2026-06-03', 1, 1)).toEqual(new Date(2026, 5, 1));
  });

  it('has no "today" before the plan starts', () => {
    // The bug this replaced: a June plan showed a week-one workout as today's
    // every day of the autumn before it.
    expect(planPositionToday('2027-06-07', new Date(2026, 8, 29))).toBeNull();
    expect(planPositionToday('2027-06-07', new Date(2027, 5, 7))).toEqual({ week: 1, day: 1 });
    expect(planPositionToday('2027-06-07', new Date(2027, 5, 16))).toEqual({ week: 2, day: 3 });
  });

  it('keeps counting weeks correctly across a clock change', () => {
    // The week of 8 March 2027 is an hour short where clocks spring forward.
    // Dividing elapsed time by exactly seven days called the next Monday the
    // week before. Only visible in a zone with the change, but never wrong.
    expect(currentWeekNumber('2027-03-08', new Date(2027, 2, 15))).toBe(2);
    expect(currentWeekNumber('2027-03-08', new Date(2027, 2, 14))).toBe(1);
  });
});

describe('formatShortDate', () => {
  it('reads as a month and day', () => {
    expect(formatShortDate(new Date(2027, 5, 7))).toMatch(/Jun\s*7|7\s*Jun/);
  });
});

describe('labels', () => {
  it('says one-on-one rather than private_client', () => {
    expect(roleLabel('private_client')).toBe('One-on-one');
    expect(roleLabel('admin')).toBe('Admin');
  });

  it('does not print a trailing zero on whole miles', () => {
    expect(formatMiles(6)).toBe('6 mi');
    expect(formatMiles(6.2)).toBe('6.2 mi');
    expect(formatMiles(null)).toBeNull();
  });
});

describe('formatMileRange', () => {
  it('reads as a single distance when there is no range', () => {
    expect(formatMileRange(6, null)).toBe('6 mi');
    expect(formatMileRange(6.2, null)).toBe('6.2 mi');
    expect(formatMileRange(null, null)).toBeNull();
  });

  it('joins the two ends with an en dash, not a hyphen', () => {
    // A hyphen next to times like 42:30 reads as a minus sign.
    expect(formatMileRange(4, 6)).toBe('4\u20136 mi');
    expect(formatMileRange(4.5, 6.25)).toBe('4.5\u20136.25 mi');
  });

  it('ignores a far end that is not actually further', () => {
    // Stored rows should never look like this, but a range of nothing is
    // worse to show than the single distance it really is.
    expect(formatMileRange(6, 6)).toBe('6 mi');
    expect(formatMileRange(6, 4)).toBe('6 mi');
  });

  it('shows nothing when only the far end is set', () => {
    // Half a range is not a distance, so it is not rendered as one.
    expect(formatMileRange(null, 6)).toBeNull();
  });
});
