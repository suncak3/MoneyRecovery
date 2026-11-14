import { addDays, toDayNumber, toIsoDate, weekdayOf, workweekStart } from "./pay/dates";
import { assumedPayday, periodContaining, shiftPeriod, type PayPeriod } from "./pay/periods";
import type { Settings, Shift, Stub } from "./pay/types";

/**
 * Maria, a warehouse associate paid biweekly. Her data is generated relative to today and
 * goes through the same engine as anyone else's; nothing about the result is hardcoded.
 */
export const SAMPLE_NAME = "Maria";

export type SamplePeriods = { shortfallPeriodId: string; repaymentPeriodId: string };

export type SampleData = {
  settings: Settings;
  shifts: Shift[];
  periods: SamplePeriods;
};

const weekdays = (weekStart: string) => [1, 2, 3, 4, 5].map((offset) => addDays(weekStart, offset));

const shiftOn = (date: string, start: string, end: string): Shift => ({
  id: `sample-${date}`,
  date,
  start,
  end,
  breakMin: 30,
});

/** The latest biweekly period (Sunday start) whose Friday payday is today or earlier. */
function latestPaidPeriod(today: string): PayPeriod {
  const anchor = toIsoDate(workweekStart(toDayNumber(today), 0));
  const settings: Settings = { rateCents: 2200, frequency: "biweekly", weekStartsOn: 0, periodAnchor: anchor };
  let period = periodContaining(today, settings);
  while (assumedPayday(period) > today) period = shiftPeriod(period, "biweekly", -1);
  return period;
}

export function buildSample(today: string): SampleData {
  const repaymentPeriod = latestPaidPeriod(today);
  const shortfallPeriod = shiftPeriod(repaymentPeriod, "biweekly", -1);
  const [week1, week2] = shortfallPeriod.weekStarts;

  const shifts: Shift[] = [
    // 9.0 h a day: 45.0 h, five hours of overtime.
    ...weekdays(week1).map((d) => shiftOn(d, "07:00", "16:30")),
    // 7.0 h a day: 35.0 h. Averaged with week 1 this looks like 80 h and no overtime.
    ...weekdays(week2).map((d) => shiftOn(d, "07:00", "14:30")),
  ];

  // Ordinary 8.0 h weekdays from the next period up to yesterday.
  for (let day = repaymentPeriod.start; day < today; day = addDays(day, 1)) {
    const weekday = weekdayOf(toDayNumber(day));
    if (weekday >= 1 && weekday <= 5) shifts.push(shiftOn(day, "07:00", "15:30"));
  }

  return {
    settings: { rateCents: 2200, frequency: "biweekly", weekStartsOn: 0, periodAnchor: shortfallPeriod.start },
    shifts,
    periods: { shortfallPeriodId: shortfallPeriod.id, repaymentPeriodId: repaymentPeriod.id },
  };
}

const healthPremium = { name: "Health insurance (pre-tax)", amountCents: 4500, reducesFica: true };

/** Maria's stub for the short period: the employer averaged both weeks to 80 hours and paid no overtime. */
export function sampleShortfallStub(periodId: string): Stub {
  return {
    periodId,
    regMinutes: 80 * 60,
    regPayCents: 176_000,
    otMinutes: 0,
    otPayCents: 0,
    grossCents: 176_000,
    preTax: [healthPremium],
    ssCents: 10_633,
    medicareCents: 2487,
    fedTaxCents: 13_200,
    stateTaxCents: 0,
    netCents: 145_180,
  };
}

/** Maria's next stub, which includes the missing overtime as a retro-pay line. */
export function sampleRepaymentStub(periodId: string): Stub {
  return {
    periodId,
    regMinutes: 80 * 60,
    regPayCents: 176_000,
    otMinutes: 0,
    otPayCents: 0,
    adjustmentCents: 5500,
    grossCents: 181_500,
    preTax: [healthPremium],
    ssCents: 10_974,
    medicareCents: 2567,
    fedTaxCents: 13_600,
    stateTaxCents: 0,
    netCents: 149_859,
  };
}
