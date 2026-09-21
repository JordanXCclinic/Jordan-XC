import {
  formatDuration,
  formatMileRange,
  formatMiles,
  parseDuration,
  parseLocalDateTime,
  planDayLabel,
  roleLabel,
} from '../lib/format';
import { currentWeekNumber, planDayToday } from '../lib/training';

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
