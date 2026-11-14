import { addDays, toDayNumber, toIsoDate, weekdayOf, workweekStart, type Weekday } from "./dates";
import type { PayFrequency, Settings } from "./types";

export type PayPeriod = {
  /** The period's first day, which doubles as its id. */
  id: string;
  start: string;
  /** Last day of the period, inclusive. */
  end: string;
  /** First day of each workweek in the period, in order. */
  weekStarts: string[];
};

export function weeksPerPeriod(frequency: PayFrequency): number {
  return frequency === "weekly" ? 1 : 2;
}

/** Pay periods line up with workweeks, so an anchor is moved back to the start of its workweek. */
export function alignAnchor(isoDate: string, weekStartsOn: Weekday): string {
  return toIsoDate(workweekStart(toDayNumber(isoDate), weekStartsOn));
}

export function periodStarting(start: string, frequency: PayFrequency): PayPeriod {
  const weeks = weeksPerPeriod(frequency);
  return {
    id: start,
    start,
    end: addDays(start, weeks * 7 - 1),
    weekStarts: Array.from({ length: weeks }, (_, i) => addDays(start, i * 7)),
  };
}

export function periodContaining(isoDate: string, settings: Settings): PayPeriod {
  const length = weeksPerPeriod(settings.frequency) * 7;
  const offset = toDayNumber(isoDate) - toDayNumber(settings.periodAnchor);
  const index = Math.floor(offset / length);
  return periodStarting(addDays(settings.periodAnchor, index * length), settings.frequency);
}

export function shiftPeriod(period: PayPeriod, frequency: PayFrequency, count: number): PayPeriod {
  return periodStarting(addDays(period.start, count * weeksPerPeriod(frequency) * 7), frequency);
}

/** Payday is assumed to be the Friday after the period ends (used for display and the sample only). */
export function assumedPayday(period: PayPeriod): string {
  const dayAfterEnd = toDayNumber(period.end) + 1;
  const daysToFriday = (5 - weekdayOf(dayAfterEnd) + 7) % 7;
  return toIsoDate(dayAfterEnd + daysToFriday);
}
