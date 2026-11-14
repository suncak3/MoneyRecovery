import { MINUTES_PER_DAY, parseClock, toDayNumber, toIsoDate, workweekStart, type Weekday } from "./dates";
import { divRound } from "./money";
import type { Shift } from "./types";

/** Start and end of a shift in absolute minutes. A shift that ends at or before its start ends the next day. */
export function shiftSpan(shift: Pick<Shift, "date" | "start" | "end">): { from: number; to: number } {
  const dayStart = toDayNumber(shift.date) * MINUTES_PER_DAY;
  const from = dayStart + parseClock(shift.start);
  let to = dayStart + parseClock(shift.end);
  if (to <= from) to += MINUTES_PER_DAY;
  return { from, to };
}

/** Paid minutes: elapsed time minus the unpaid break, never below zero. */
export function shiftMinutes(shift: Shift): number {
  const { from, to } = shiftSpan(shift);
  return Math.max(0, to - from - shift.breakMin);
}

export type WeekSegment = { weekStart: string; minutes: number };

/**
 * Splits a shift at workweek boundaries (federal rule: each workweek stands alone).
 * When a shift crosses a boundary, its unpaid break is shared in proportion to the time
 * on each side, since the stub does not tell us when the break was taken.
 */
export function splitByWorkweek(shift: Shift, weekStartsOn: Weekday): WeekSegment[] {
  const { from, to } = shiftSpan(shift);
  const elapsed = to - from;
  const paid = shiftMinutes(shift);

  const firstWeek = workweekStart(Math.floor(from / MINUTES_PER_DAY), weekStartsOn);
  const boundary = (firstWeek + 7) * MINUTES_PER_DAY;

  if (to <= boundary) {
    return [{ weekStart: toIsoDate(firstWeek), minutes: paid }];
  }

  const firstPaid = divRound((boundary - from) * paid, elapsed);
  return [
    { weekStart: toIsoDate(firstWeek), minutes: firstPaid },
    { weekStart: toIsoDate(firstWeek + 7), minutes: paid - firstPaid },
  ];
}

/** Paid minutes per calendar day, attributing each shift to the day it starts on. */
export function minutesByDay(shifts: Shift[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const shift of shifts) byDay.set(shift.date, (byDay.get(shift.date) ?? 0) + shiftMinutes(shift));
  return byDay;
}
