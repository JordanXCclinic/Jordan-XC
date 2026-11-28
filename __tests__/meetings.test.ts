import { meetingUnderway, nextMeeting } from '../lib/meetings';

const now = new Date('2026-11-28T18:00:00Z');
const slot = (id: string, startsAt: string, minutes = 30) => ({
  id,
  starts_at: startsAt,
  duration_minutes: minutes,
});

describe('nextMeeting', () => {
  it('picks the soonest meeting that has not finished', () => {
    const later = slot('later', '2026-12-02T00:00:00Z');
    const sooner = slot('sooner', '2026-11-30T00:00:00Z');
    const over = slot('over', '2026-11-28T17:00:00Z');
    expect(nextMeeting([later, over, sooner], now)?.id).toBe('sooner');
  });

  it('keeps one that is under way, and drops it once it ends', () => {
    const underway = slot('now', '2026-11-28T17:45:00Z');
    expect(nextMeeting([underway], now)?.id).toBe('now');
    expect(meetingUnderway(underway, now)).toBe(true);
    expect(nextMeeting([underway], new Date('2026-11-28T18:15:00Z'))).toBeNull();
  });

  it('is nothing with no meetings', () => {
    expect(nextMeeting([], now)).toBeNull();
    expect(meetingUnderway(slot('x', '2026-11-29T00:00:00Z'), now)).toBe(false);
  });
});
