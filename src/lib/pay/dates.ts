/**
 * Calendar math on plain day numbers (days since 1970-01-01) so the result never
 * depends on the browser's time zone or daylight-saving changes.
 */

export const MINUTES_PER_DAY = 24 * 60;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayNumber(isoDate: string): number {
  const match = ISO_DATE.exec(isoDate);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${isoDate}"`);
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86_400_000;
}

export function toIsoDate(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return toIsoDate(toDayNumber(isoDate) + days);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return toDayNumber(toIso) - toDayNumber(fromIso);
}

/** 1970-01-01 was a Thursday. */
export function weekdayOf(dayNumber: number): Weekday {
  return (((dayNumber + 4) % 7) + 7) % 7 as Weekday;
}

/** Day number of the first day of the workweek that contains `dayNumber`. */
export function workweekStart(dayNumber: number, weekStartsOn: Weekday): number {
  return dayNumber - ((weekdayOf(dayNumber) - weekStartsOn + 7) % 7);
}

/** "07:30" → 450 */
export function parseClock(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`Expected HH:MM, got "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Local calendar date of a Date object as YYYY-MM-DD (what the user sees as "today"). */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-02" → "Nov 2, 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-11-02" → "Mon, Nov 2" */
export function formatDayShort(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(toDayNumber(isoDate))]}, ${MONTHS[m - 1]} ${d}`;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
