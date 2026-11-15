"use client";

import { useParams } from "next/navigation";
import { NeedsSetup } from "@/components/needs-setup";
import { PayBreakdown } from "@/components/pay-breakdown";
import { BackLink, Button, Card, Disclaimer, Loading } from "@/components/ui";
import { WeekChart } from "@/components/week-chart";
import { expectedForPeriod } from "@/lib/check";
import { totalDeductions } from "@/lib/pay/audit";
import { FINDING_TITLES } from "@/lib/pay/causes";
import { formatDate, formatDayShort, localIsoDate } from "@/lib/pay/dates";
import { shiftMinutes } from "@/lib/pay/hours";
import { formatHours, formatUsd } from "@/lib/pay/money";
import { periodStarting } from "@/lib/pay/periods";
import { useAppState, useNow } from "@/lib/store";

export default function EvidencePage() {
  const { id } = useParams<{ id: string }>();
  const state = useAppState();
  const now = useNow(state);
  if (!state) return <Loading />;
  if (!state.settings) return <NeedsSetup />;

  const c = state.cases.find((rc) => rc.id === id);
  const stub = c && state.stubs.find((s) => s.periodId === c.periodId);
  const audit = c && state.audits.find((a) => a.periodId === c.periodId);
  if (!c || !stub || !audit) return <p className="text-muted">We couldn&apos;t find this case.</p>;

  const period = periodStarting(c.periodId, state.settings.frequency);
  const expected = expectedForPeriod({ settings: state.settings, shifts: state.shifts }, c.periodId);
  const shifts = state.shifts
    .filter((s) => s.date >= period.start && s.date <= period.end)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const cause = audit.findings.find((f) => f.code === c.causeCode);

  const stubRows: [string, string][] = [
    ["Regular hours", stub.regMinutes !== undefined ? `${formatHours(stub.regMinutes)} h` : "—"],
    ["Regular pay", stub.regPayCents !== undefined ? formatUsd(stub.regPayCents) : "—"],
    ["Overtime hours", stub.otMinutes !== undefined ? `${formatHours(stub.otMinutes)} h` : "—"],
    ["Overtime pay", stub.otPayCents !== undefined ? formatUsd(stub.otPayCents) : "—"],
    ["Gross pay", formatUsd(stub.grossCents)],
    ["Deductions and taxes", formatUsd(totalDeductions(stub))],
    ["Net pay", formatUsd(stub.netCents)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/app/cases/${c.id}`}>Back to the case</BackLink>
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>

      <header>
        <p className="text-sm text-muted">Pay discrepancy summary · prepared {formatDate(localIsoDate(now))}</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Pay period {formatDate(period.start)} – {formatDate(period.end)}
        </h1>
        <p className="mt-2">
          Possible shortfall of <strong className="tabular">{formatUsd(c.amountCents)}</strong> in gross pay. {FINDING_TITLES[c.causeCode]}
        </p>
        {cause && <p className="mt-2 text-sm text-muted">{cause.detail}</p>}
      </header>

      <Card className="print-plain">
        <h2 className="mb-3 font-semibold">Shifts worked</h2>
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 font-medium">Date</th>
              <th className="py-1.5 font-medium">Time</th>
              <th className="py-1.5 font-medium">Unpaid break</th>
              <th className="py-1.5 text-right font-medium">Paid hours</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="py-1.5">{formatDayShort(s.date)}</td>
                <td className="py-1.5">
                  {s.start}–{s.end}
                </td>
                <td className="py-1.5">{s.breakMin} min</td>
                <td className="py-1.5 text-right">{formatHours(shiftMinutes(s))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="print-plain">
          <h2 className="mb-4 font-semibold">Calculation (federal overtime, per workweek)</h2>
          <PayBreakdown expected={expected} />
        </Card>
        <Card className="print-plain">
          <h2 className="mb-4 font-semibold">Figures on the pay stub</h2>
          <dl className="tabular flex flex-col gap-1.5 text-sm">
            {stubRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="print-plain break-inside-avoid">
        <h2 className="mb-4 font-semibold">Hours by workweek</h2>
        <WeekChart expected={expected} shifts={shifts} />
      </Card>

      <p className="text-sm text-muted">
        Overtime rule applied: under the federal Fair Labor Standards Act, hours over 40 in a workweek are paid at 1.5 times the regular rate, and each
        workweek stands alone; hours are not averaged across weeks (29 CFR 778.104–778.105).
      </p>
      <Disclaimer />
    </div>
  );
}
