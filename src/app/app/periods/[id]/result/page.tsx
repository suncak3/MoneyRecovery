"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { NeedsSetup } from "@/components/needs-setup";
import { PayBreakdown } from "@/components/pay-breakdown";
import { Button, Card, Disclaimer, LinkButton, Loading } from "@/components/ui";
import { WeekChart } from "@/components/week-chart";
import { canOpenCase, startCase } from "@/lib/actions";
import { expectedForPeriod } from "@/lib/check";
import { FINDING_TITLES } from "@/lib/pay/causes";
import { formatDate } from "@/lib/pay/dates";
import { formatHours, formatUsd } from "@/lib/pay/money";
import { periodStarting } from "@/lib/pay/periods";
import type { AuditLine, Finding } from "@/lib/pay/types";
import type { StoredAudit } from "@/lib/storage";
import { setState, useAppState, useNow } from "@/lib/store";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const state = useAppState();
  const now = useNow(state);
  if (!state) return <Loading />;
  if (!state.settings) return <NeedsSetup />;

  const audit = state.audits.find((a) => a.periodId === id);
  if (!audit) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-muted">This paycheck hasn&apos;t been checked yet.</p>
        <LinkButton href={`/app/periods/${id}/check`} className="mt-4">
          Check it now
        </LinkButton>
      </Card>
    );
  }

  const settings = state.settings;
  const period = periodStarting(id, settings.frequency);
  const expected = expectedForPeriod({ settings, shifts: state.shifts }, id);
  const shifts = state.shifts.filter((s) => s.date >= period.start && s.date <= period.end);
  const existingCase = state.cases.find((c) => c.periodId === id);
  const cause = audit.findings.find((f) => f.code === audit.causeCode && f.code !== "MATCH");
  const otherFindings = audit.findings.filter((f) => f !== cause && f.code !== "MATCH");

  function startRecovery() {
    if (!state || !canOpenCase(state)) {
      router.push(`/app/checkout?period=${id}`);
      return;
    }
    const caseId = crypto.randomUUID();
    setState((s) => startCase(s, id, caseId, now));
    router.push(`/app/cases/${caseId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted">
        <Link href="/app" className="hover:text-accent">
          Home
        </Link>{" "}
        / Pay period {formatDate(period.start)} – {formatDate(period.end)}
      </div>

      <VerdictBanner audit={audit} />

      {audit.repayment && (
        <Link
          href={`/app/cases/${audit.repayment.caseId}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-accent bg-surface p-5 hover:bg-accent-soft"
        >
          <span>
            <span className="block text-sm text-muted">Recovery case closed</span>
            <span className="text-lg font-semibold text-accent-strong">{formatUsd(audit.repayment.amountCents)} recovered on this paycheck</span>
          </span>
          <span className="text-sm font-medium text-accent">View the case →</span>
        </Link>
      )}

      {cause && (
        <Card>
          <h2 className="text-sm font-medium text-muted">Probable cause</h2>
          <p className="mt-1 text-lg font-semibold">{FINDING_TITLES[cause.code]}</p>
          <p className="mt-2 leading-relaxed">{cause.detail}</p>
          {audit.verdict === "shortfall" && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {existingCase ? (
                <LinkButton href={`/app/cases/${existingCase.id}`}>Open your recovery case</LinkButton>
              ) : (
                <Button onClick={startRecovery}>Start a Recovery Case</Button>
              )}
              <span className="text-sm text-muted">Most payroll errors are honest mistakes. We&apos;ll help you ask, step by step.</span>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">Line by line</h2>
        <ComparisonTable lines={audit.lines} />
        <p className="mt-3 text-xs text-muted">Lines you left blank on the form show a dash and aren&apos;t checked.</p>
      </Card>

      {otherFindings.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Also worth knowing</h2>
          <ul className="flex flex-col gap-3">
            {otherFindings.map((f, i) => (
              <FindingItem key={i} finding={f} />
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">How we got the expected amount</h2>
          <PayBreakdown expected={expected} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Your hours by workweek</h2>
          <WeekChart expected={expected} shifts={shifts} />
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <LinkButton href={`/app/periods/${id}/check`} variant="secondary">
          Edit stub numbers
        </LinkButton>
        <LinkButton href={`/app/shifts?period=${id}`} variant="secondary">
          Review shifts
        </LinkButton>
      </div>

      <Disclaimer />
    </div>
  );
}

function VerdictBanner({ audit }: { audit: StoredAudit }) {
  const gross = audit.lines.find((l) => l.label.startsWith("Gross"));
  if (audit.verdict === "shortfall") {
    return (
      <div className="rounded-xl bg-alert-soft p-6">
        <p className="text-sm font-medium text-alert">Possible shortfall</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-alert">{formatUsd(audit.shortfallCents)}</p>
        <p className="mt-2 text-sm">Your paycheck looks lower than your logged shifts suggest. It&apos;s worth asking payroll.</p>
      </div>
    );
  }
  if (audit.verdict === "overpaid") {
    return (
      <div className="rounded-xl bg-warn-soft p-6">
        <p className="text-sm font-medium text-warn">Paid more than your log</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-warn">
          {gross && gross.expected !== null && gross.actual !== null ? formatUsd(gross.actual - gross.expected) : ""}
        </p>
        <p className="mt-2 text-sm">Double-check your shifts. Overpayments are often taken back on a later paycheck.</p>
      </div>
    );
  }
  return (
    <div className={`rounded-xl p-6 ${audit.verdict === "match" ? "bg-accent-soft" : "bg-warn-soft"}`}>
      <p className={`text-sm font-medium ${audit.verdict === "match" ? "text-accent-strong" : "text-warn"}`}>
        {audit.verdict === "match" ? "Matches your log" : "Gross pay matches, but something is worth a look"}
      </p>
      <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{gross?.actual != null ? `${formatUsd(gross.actual)} verified` : "Verified"}</p>
      <p className="mt-2 text-sm">
        {audit.verdict === "match" ? "Nice. This paycheck counts toward your verified paychecks." : "See the details below."}
      </p>
    </div>
  );
}

const show = (line: AuditLine, value: number | null) =>
  value === null ? "—" : line.unit === "hours" ? `${formatHours(value)} h` : formatUsd(value);

function ComparisonTable({ lines }: { lines: AuditLine[] }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="tabular w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-2 py-2 font-medium">Line</th>
            <th className="px-2 py-2 text-right font-medium">Expected</th>
            <th className="px-2 py-2 text-right font-medium">On your stub</th>
            <th className="px-2 py-2 text-right font-medium">Difference</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const diff = line.expected !== null && line.actual !== null ? line.actual - line.expected : null;
            const off = diff !== null && diff !== 0;
            return (
              <tr key={line.label} className="border-t border-line">
                <td className="px-2 py-2.5">{line.label}</td>
                <td className="px-2 py-2.5 text-right">{show(line, line.expected)}</td>
                <td className="px-2 py-2.5 text-right">{show(line, line.actual)}</td>
                <td className={`px-2 py-2.5 text-right ${off ? "font-semibold text-alert" : "text-muted"}`}>
                  {diff === null ? "—" : diff === 0 ? "✓" : `${diff > 0 ? "+" : ""}${show(line, diff)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FindingItem({ finding }: { finding: Finding }) {
  return (
    <li className="flex gap-3 text-sm">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${finding.severity === "issue" ? "bg-warn" : "bg-accent"}`}
      />
      <div>
        <p className="font-medium">{FINDING_TITLES[finding.code]}</p>
        <p className="text-muted">{finding.detail}</p>
      </div>
    </li>
  );
}
