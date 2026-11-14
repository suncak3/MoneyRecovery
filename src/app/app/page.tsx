"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackupLinks } from "@/components/backup-links";
import { NeedsSetup } from "@/components/needs-setup";
import { CaseStatusChip, PeriodStatusChip } from "@/components/status-chip";
import { Button, Card, LinkButton, Loading, Stat } from "@/components/ui";
import { homeTotals } from "@/lib/actions";
import { ladderPosition, STEP_TITLES } from "@/lib/case/ladder";
import { isOpen } from "@/lib/case/types";
import { formatDate, localIsoDate, toDayNumber, toIsoDate, workweekStart, type Weekday } from "@/lib/pay/dates";
import { formatHours, formatUsd } from "@/lib/pay/money";
import { periodSummaries, type PeriodSummary } from "@/lib/overview";
import { SAMPLE_NAME } from "@/lib/sample";
import { emptyState } from "@/lib/storage";
import { setState, useAppState, useNow } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const state = useAppState();
  const now = useNow(state);
  if (!state) return <Loading />;
  if (!state.settings) return <NeedsSetup />;

  const today = localIsoDate(now);
  const totals = homeTotals(state);
  const periods = periodSummaries(state, today);
  const current = periods.find((p) => p.status === "in_progress") ?? null;
  const toCheck = periods.filter((p) => p.status === "needs_check").sort((a, b) => a.period.start.localeCompare(b.period.start));
  const nextToCheck = toCheck[0] ?? null;
  const openCases = state.cases.filter(isOpen);

  function reset() {
    setState(emptyState());
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-6">
      {state.sample && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          <span>
            You&apos;re looking at sample data for <strong>{SAMPLE_NAME}</strong>, a warehouse associate paid {formatUsd(state.settings.rateCents)}/h every two weeks.
          </span>
          <button type="button" onClick={reset} className="font-medium underline underline-offset-2">
            Reset demo data
          </button>
        </div>
      )}

      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Recovered so far" value={<span className="text-accent">{formatUsd(totals.recoveredCents)}</span>} />
          <Stat label="Open cases" value={totals.openCases} />
          <Stat label="Paychecks verified" value={totals.verifiedPaychecks} />
        </div>
      </Card>

      {openCases.map((c) => {
        const position = ladderPosition(c, now);
        return (
          <Link key={c.id} href={`/app/cases/${c.id}`} className="block rounded-xl border-2 border-accent bg-surface p-5 transition-colors hover:bg-accent-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">Recovery case · period starting {formatDate(c.periodId)}</span>
              <CaseStatusChip status={c.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="tabular text-2xl font-semibold">{formatUsd(c.amountCents)}</span>
              <span className="font-medium text-accent">
                Step {position.step}: {STEP_TITLES[position.step]} →
              </span>
            </div>
          </Link>
        );
      })}

      {nextToCheck && (
        <Card className="border-warn/40 bg-warn-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Has your paycheck for {formatDate(nextToCheck.period.start)} – {formatDate(nextToCheck.period.end)} arrived?</h2>
              <p className="mt-1 text-sm text-muted">
                Your log says it should be <strong className="tabular text-ink">{formatUsd(nextToCheck.expected.grossCents)}</strong> gross. Compare it with your stub.
              </p>
            </div>
            <LinkButton href={`/app/periods/${nextToCheck.period.id}/check`}>Check my paycheck</LinkButton>
          </div>
        </Card>
      )}

      {current && (
        <CurrentPeriod
          summary={current}
          today={today}
          weekStartsOn={state.settings.weekStartsOn}
          paycheckHref={paycheckHref(nextToCheck ?? periods.find((p) => p.status !== "in_progress") ?? null)}
        />
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Pay periods</h2>
        <ul className="divide-y divide-line">
          {periods.map((p) => (
            <li key={p.period.id}>
              <Link href={periodHref(p)} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-accent">
                <span>
                  {formatDate(p.period.start)} – {formatDate(p.period.end)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular hidden text-muted sm:inline">{formatUsd(p.expected.grossCents)} expected</span>
                  <PeriodStatusChip status={p.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <BackupLinks />
        {!state.sample && (
          <Button variant="ghost" onClick={reset} className="text-muted">
            Reset all data
          </Button>
        )}
      </div>
    </div>
  );
}

function periodHref(p: PeriodSummary) {
  if (p.recoveryCase) return `/app/cases/${p.recoveryCase.id}`;
  if (p.audit) return `/app/periods/${p.period.id}/result`;
  if (p.status === "needs_check") return `/app/periods/${p.period.id}/check`;
  return `/app/shifts?period=${p.period.id}`;
}

function paycheckHref(p: PeriodSummary | null) {
  return p ? `/app/periods/${p.period.id}/check` : null;
}

function CurrentPeriod({
  summary,
  today,
  weekStartsOn,
  paycheckHref,
}: {
  summary: PeriodSummary;
  today: string;
  weekStartsOn: Weekday;
  paycheckHref: string | null;
}) {
  const thisWeekStart = toIsoDate(workweekStart(toDayNumber(today), weekStartsOn));
  const week = summary.expected.weeks.find((w) => w.weekStart === thisWeekStart);
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Current pay period</h2>
        <span className="text-sm text-muted">
          {formatDate(summary.period.start)} – {formatDate(summary.period.end)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Hours this week" value={formatHours(week?.totalMinutes ?? 0, 1)} />
        <Stat label="Overtime this week" value={formatHours(week?.otMinutes ?? 0, 1)} hint="Over 40 h in the workweek" />
        <Stat label="Expected gross so far" value={formatUsd(summary.expected.grossCents)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <LinkButton href="/app/shifts">Add shift</LinkButton>
        {paycheckHref && (
          <LinkButton href={paycheckHref} variant="secondary">
            My paycheck arrived
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
