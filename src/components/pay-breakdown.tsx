import { formatDate } from "@/lib/pay/dates";
import { formatHours, formatUsd } from "@/lib/pay/money";
import { overtimePay, type ExpectedPay } from "@/lib/pay/overtime";

const h = (minutes: number) => `${formatHours(minutes)} h`;

/** Shows each step of the engine's calculation so the user can check the math themselves. */
export function PayBreakdown({ expected }: { expected: ExpectedPay }) {
  const otRate = overtimePay(60, expected.rateCents);
  return (
    <div className="tabular text-sm">
      <ol className="flex flex-col gap-1.5">
        {expected.weeks.map((w) => (
          <li key={w.weekStart} className="flex justify-between gap-4">
            <span className="text-muted">Week of {formatDate(w.weekStart)}</span>
            <span>
              {h(w.totalMinutes)} = {h(w.regMinutes)} regular
              {w.otMinutes > 0 && <span className="font-medium text-warn"> + {h(w.otMinutes)} overtime</span>}
            </span>
          </li>
        ))}
      </ol>
      <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            Regular: {h(expected.regMinutes)} × {formatUsd(expected.rateCents)}
          </dt>
          <dd>{formatUsd(expected.regPayCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            Overtime: {h(expected.otMinutes)} × {formatUsd(otRate)} (1.5×)
          </dt>
          <dd>{formatUsd(expected.otPayCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
          <dt>Expected gross pay</dt>
          <dd>{formatUsd(expected.grossCents)}</dd>
        </div>
      </dl>
    </div>
  );
}
