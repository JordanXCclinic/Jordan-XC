const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Workout days are stored 1–7, Monday first, matching how coaches write plans. */
export const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const planDayLabel = (day: number): string => PLAN_DAYS[day - 1] ?? '—';

export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDayHeading(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  return `${DAY_NAMES[date.getDay()]}, ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** "in 3 days", "2 hours ago" — used on announcements and meeting slots. */
export function formatRelative(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const past = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return past ? `${minutes}m ago` : `in ${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 7) return past ? `${days}d ago` : `in ${days}d`;

  return formatDate(date);
}

const pad = (value: number): string => String(value).padStart(2, '0');

export const toDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toTimeInput = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Builds a Date in the device's own zone from typed parts. `new Date("...")` on
 * a bare date string is parsed as UTC, which would shift a practice by hours.
 */
export function parseLocalDateTime(dateInput: string, timeInput: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeInput.trim());
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** mm:ss from a stored duration, so athletes read splits the way they say them. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatMiles(miles: number | null): string | null {
  if (miles === null) return null;
  const trimmed = Number(miles);
  return `${trimmed % 1 === 0 ? trimmed.toFixed(0) : trimmed.toFixed(2).replace(/0$/, '')} mi`;
}

export const firstName = (fullName: string | null | undefined): string =>
  fullName?.trim().split(/\s+/)[0] ?? '';

export const roleLabel = (role: string): string =>
  ({
    admin: 'Admin',
    coach: 'Coach',
    athlete: 'Athlete',
    private_client: 'One-on-one',
    parent: 'Parent',
  })[role] ?? role;
