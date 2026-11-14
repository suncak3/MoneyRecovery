import { addDays, formatDate, formatDayShort } from "@/lib/pay/dates";
import { minutesByDay } from "@/lib/pay/hours";
import { formatHours } from "@/lib/pay/money";
import { WEEKLY_OT_THRESHOLD_MIN, type ExpectedPay } from "@/lib/pay/overtime";
import type { Shift } from "@/lib/pay/types";

/** Scale: the longer of the busiest week or 50 h, so the 40 h line sits in the same place for every week. */
function scaleMinutes(expected: ExpectedPay) {
  return Math.max(50 * 60, ...expected.weeks.map((w) => w.totalMinutes));
}

/**
 * One bar per workweek, split into days, with the 40-hour line drawn on top. Hours past the
 * line are overtime. Seeing two weeks side by side makes "averaged" overtime easy to spot.
 */
export function WeekChart({ expected, shifts }: { expected: ExpectedPay; shifts: Shift[] }) {
  const scale = scaleMinutes(expected);
  const perDay = minutesByDay(shifts);
  const thresholdPct = (WEEKLY_OT_THRESHOLD_MIN / scale) * 100;

  return (
    <figure className="flex flex-col gap-5">
      {expected.weeks.map((week) => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(week.weekStart, i))
          .map((date) => ({ date, minutes: perDay.get(date) ?? 0 }))
          .filter((d) => d.minutes > 0);
        return (
          <div key={week.weekStart}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">Week of {formatDate(week.weekStart)}</span>
              <span className="tabular text-muted">
                {formatHours(week.totalMinutes)} h
                {week.otMinutes > 0 && <span className="ml-2 font-medium text-warn">{formatHours(week.otMinutes)} h overtime</span>}
              </span>
            </div>
            <div
              className="relative h-9 rounded-md bg-paper"
              role="img"
              aria-label={`${formatHours(week.totalMinutes)} hours in the week of ${formatDate(week.weekStart)}, ${formatHours(week.otMinutes)} of them overtime`}
            >
              <div className="absolute inset-0 flex gap-px overflow-hidden rounded-md">
                {days.map((d) => (
                  <div
                    key={d.date}
                    title={`${formatDayShort(d.date)}: ${formatHours(d.minutes)} h`}
                    className="h-full bg-accent/80"
                    style={{ width: `${(d.minutes / scale) * 100}%` }}
                  />
                ))}
              </div>
              {week.otMinutes > 0 && (
                <div
                  className="absolute inset-y-0 rounded-r-md bg-[repeating-linear-gradient(135deg,var(--color-warn)_0_4px,transparent_4px_8px)] opacity-70"
                  style={{ left: `${thresholdPct}%`, width: `${(week.otMinutes / scale) * 100}%` }}
                />
              )}
              <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${thresholdPct}%` }} />
            </div>
          </div>
        );
      })}
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-accent/80" /> Hours worked, one block per day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-ink" /> 40 h: overtime starts, counted per week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[repeating-linear-gradient(135deg,var(--color-warn)_0_3px,transparent_3px_6px)]" />
          Overtime (1.5×)
        </span>
      </figcaption>
    </figure>
  );
}
