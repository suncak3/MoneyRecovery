import { splitByWorkweek } from "./hours";
import { divRound } from "./money";
import type { PayPeriod } from "./periods";
import type { Settings, Shift } from "./types";

/** FLSA: overtime is every minute over 40 hours within a single workweek. */
export const WEEKLY_OT_THRESHOLD_MIN = 40 * 60;

export type WeekTotal = {
  weekStart: string;
  totalMinutes: number;
  regMinutes: number;
  otMinutes: number;
};

export type ExpectedPay = {
  periodId: string;
  rateCents: number;
  weeks: WeekTotal[];
  regMinutes: number;
  otMinutes: number;
  regPayCents: number;
  otPayCents: number;
  grossCents: number;
};

export function regularPay(minutes: number, rateCents: number): number {
  return divRound(minutes * rateCents, 60);
}

export function overtimePay(minutes: number, rateCents: number): number {
  return divRound(minutes * rateCents * 3, 2 * 60);
}

export function splitWeek(weekStart: string, totalMinutes: number): WeekTotal {
  const regMinutes = Math.min(totalMinutes, WEEKLY_OT_THRESHOLD_MIN);
  return { weekStart, totalMinutes, regMinutes, otMinutes: totalMinutes - regMinutes };
}

export function weeklyTotals(shifts: Shift[], period: PayPeriod, settings: Settings): WeekTotal[] {
  const minutesByWeek = new Map(period.weekStarts.map((week) => [week, 0]));
  for (const shift of shifts) {
    for (const segment of splitByWorkweek(shift, settings.weekStartsOn)) {
      const current = minutesByWeek.get(segment.weekStart);
      if (current !== undefined) minutesByWeek.set(segment.weekStart, current + segment.minutes);
    }
  }
  return period.weekStarts.map((week) => splitWeek(week, minutesByWeek.get(week) ?? 0));
}

export function payForWeeks(periodId: string, weeks: WeekTotal[], rateCents: number): ExpectedPay {
  const regMinutes = weeks.reduce((sum, w) => sum + w.regMinutes, 0);
  const otMinutes = weeks.reduce((sum, w) => sum + w.otMinutes, 0);
  const regPayCents = regularPay(regMinutes, rateCents);
  const otPayCents = overtimePay(otMinutes, rateCents);
  return {
    periodId,
    rateCents,
    weeks,
    regMinutes,
    otMinutes,
    regPayCents,
    otPayCents,
    grossCents: regPayCents + otPayCents,
  };
}

export function expectedPay(shifts: Shift[], period: PayPeriod, settings: Settings): ExpectedPay {
  return payForWeeks(period.id, weeklyTotals(shifts, period, settings), settings.rateCents);
}
