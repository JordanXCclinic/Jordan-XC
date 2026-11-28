/**
 * The meeting a runner's Home tab shows: the next one that has not finished.
 * One already under way still shows, so a family opening the app a few minutes
 * in still sees it.
 */
export function nextMeeting<S extends { starts_at: string; duration_minutes: number }>(
  slots: S[],
  now: Date = new Date()
): S | null {
  const upcoming = slots
    .filter((slot) => new Date(slot.starts_at).getTime() + slot.duration_minutes * 60_000 > now.getTime())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0] ?? null;
}

/** Whether a meeting has started and not yet finished. */
export function meetingUnderway(
  slot: { starts_at: string; duration_minutes: number },
  now: Date = new Date()
): boolean {
  const start = new Date(slot.starts_at).getTime();
  return start <= now.getTime() && now.getTime() < start + slot.duration_minutes * 60_000;
}
