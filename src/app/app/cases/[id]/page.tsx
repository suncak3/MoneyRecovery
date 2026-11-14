"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { NeedsSetup } from "@/components/needs-setup";
import { CaseStatusChip } from "@/components/status-chip";
import { Button, Card, Disclaimer, LinkButton, Loading } from "@/components/ui";
import { closeCase, skipDemoDays, updateCase } from "@/lib/actions";
import { caseFacts } from "@/lib/case/facts";
import {
  ladderPosition,
  markPaidSeparately,
  markSent,
  recordOutcome,
  STEP_TITLES,
  type LadderPosition,
  type Outcome,
} from "@/lib/case/ladder";
import { messageFor, periodLabel, type CaseFacts, type Message } from "@/lib/case/templates";
import { isOpen, isVerifiedRecovery, type CaseEvent, type LadderStep, type RecoveryCase } from "@/lib/case/types";
import { expectedForPeriod } from "@/lib/check";
import { reminderIcs } from "@/lib/ics";
import { FINDING_TITLES } from "@/lib/pay/causes";
import { formatDate, localIsoDate } from "@/lib/pay/dates";
import { formatUsd } from "@/lib/pay/money";
import { periodStarting, shiftPeriod } from "@/lib/pay/periods";
import type { PayFrequency } from "@/lib/pay/types";
import { setState, useAppState, useNow } from "@/lib/store";

const STEPS: LadderStep[] = [1, 2, 3, 4];

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const state = useAppState();
  const now = useNow(state);
  if (!state) return <Loading />;
  if (!state.settings) return <NeedsSetup />;

  const recoveryCase = state.cases.find((c) => c.id === id);
  const stub = recoveryCase && state.stubs.find((s) => s.periodId === recoveryCase.periodId);
  if (!recoveryCase || !stub) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-muted">We couldn&apos;t find this case. It may have been cleared when the pay schedule changed.</p>
        <LinkButton href="/app" className="mt-4">
          Back to home
        </LinkButton>
      </Card>
    );
  }

  const expected = expectedForPeriod({ settings: state.settings, shifts: state.shifts }, recoveryCase.periodId);
  const facts = caseFacts(recoveryCase, state.settings.frequency, expected, stub, now);
  return (
    <CaseView
      key={recoveryCase.id}
      recoveryCase={recoveryCase}
      facts={facts}
      frequency={state.settings.frequency}
      now={now}
      demoOffsetDays={state.demoClockOffsetDays}
    />
  );
}

function CaseView({
  recoveryCase: c,
  facts,
  frequency,
  now,
  demoOffsetDays,
}: {
  recoveryCase: RecoveryCase;
  facts: CaseFacts;
  frequency: PayFrequency;
  now: Date;
  demoOffsetDays: number;
}) {
  const position = ladderPosition(c, now);
  const [viewed, setViewed] = useState<LadderStep | null>(null);
  const step = viewed ?? position.step;
  const open = isOpen(c);
  const nextPeriod = shiftPeriod(periodStarting(c.periodId, frequency), frequency, 1);

  const act = (change: (rc: RecoveryCase) => RecoveryCase) => setState((s) => updateCase(s, c.id, change));

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted">
        <Link href="/app" className="hover:text-accent">
          Home
        </Link>{" "}
        / Recovery case
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Pay period {periodLabel(facts)}</p>
            <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatUsd(c.amountCents)}</p>
            <p className="mt-2">{FINDING_TITLES[c.causeCode]}</p>
          </div>
          <CaseStatusChip status={c.status} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href={`/app/cases/${c.id}/evidence`} variant="secondary">
            Evidence page (print / PDF)
          </LinkButton>
        </div>
      </Card>

      {c.status === "recovered" ? (
        <div className="rounded-xl bg-accent-soft p-6">
          <p className="text-lg font-semibold text-accent-strong">Recovered: {formatUsd(c.amountCents)} is back in your pocket.</p>
          <p className="mt-1 text-sm">
            {isVerifiedRecovery(c)
              ? c.events.findLast((e) => e.type === "recovered")?.note
              : "You reported it was paid outside your paycheck, so it wasn't confirmed on a pay stub."}
          </p>
        </div>
      ) : (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Where you are</h2>
            {open && <DemoClock offsetDays={demoOffsetDays} />}
          </div>
          <p className="mt-2 text-sm leading-relaxed">{open ? position.reason : "You closed this case. You can still copy the messages below."}</p>
          {open && position.next && (
            <p className="mt-1 text-sm text-muted">
              If it&apos;s still not fixed, step {position.next.step} ({STEP_TITLES[position.next.step]}) opens on {formatDate(localIsoDate(position.next.at))}.
            </p>
          )}
        </Card>
      )}

      {open && (
        <Card>
          <h2 className="font-semibold">How this case closes</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You don&apos;t close it by hand. When your next paycheck arrives, check it here. If it includes the missing{" "}
            {formatUsd(c.amountCents)}, as retro pay or as a higher gross, the case closes as <strong>Recovered</strong> on its own and
            the money counts as verified.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <LinkButton href={`/app/periods/${nextPeriod.id}/check`} data-guide="next-paycheck">
              Check my next paycheck
            </LinkButton>
            <Button variant="ghost" onClick={() => act((rc) => markPaidSeparately(rc, now))}>
              I got paid another way
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Use &ldquo;I got paid another way&rdquo; for a separate check or transfer that won&apos;t show up on a pay stub.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <ol className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:self-start" aria-label="Recovery steps">
          {STEPS.map((s) => (
            <StepTab key={s} step={s} position={position} selected={s === step} onSelect={() => setViewed(s)} />
          ))}
        </ol>

        <StepPanel
          key={`${step}:${facts.today}:${facts.firstSentOn}`}
          step={step}
          message={messageFor(step, facts)}
          facts={facts}
          isCurrent={step === position.step}
          isSent={position.sentSteps.includes(step)}
          anySent={position.sentSteps.length > 0}
          open={open}
          onSent={() => act((rc) => markSent(rc, step, now))}
          onOutcome={(outcome) => act((rc) => recordOutcome(rc, outcome, now))}
          caseId={c.id}
          nextReminder={position.next}
          now={now}
        />
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Timeline</h2>
        <Timeline events={c.events} />
        {open && (
          <Button variant="ghost" className="mt-4 text-muted" onClick={() => setState((s) => closeCase(s, c.id, now))}>
            Close case without recovery
          </Button>
        )}
      </Card>

      <Disclaimer />
    </div>
  );
}

function DemoClock({ offsetDays }: { offsetDays: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-warn/60 px-2 py-1 text-xs text-warn">
      <span>Demo control{offsetDays > 0 && ` · clock +${offsetDays} days`}</span>
      <button
        type="button"
        data-guide="skip-days"
        className="rounded font-semibold underline underline-offset-2"
        onClick={() => setState((s) => skipDemoDays(s, 7))}
      >
        Demo: skip ahead 7 days
      </button>
    </div>
  );
}

function StepTab({ step, position, selected, onSelect }: { step: LadderStep; position: LadderPosition; selected: boolean; onSelect: () => void }) {
  const sent = position.sentSteps.includes(step);
  const current = step === position.step;
  const locked = step > position.step;
  return (
    <li className="min-w-40 flex-1 lg:min-w-0 lg:flex-none">
      <button
        type="button"
        onClick={onSelect}
        aria-current={current ? "step" : undefined}
        className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
          selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-muted"
        } ${locked ? "opacity-60" : ""}`}
      >
        <span className="block text-xs text-muted">
          Step {step}
          {current && " · current"}
          {sent && " · sent"}
        </span>
        <span className="font-medium">{STEP_TITLES[step]}</span>
      </button>
    </li>
  );
}

function StepPanel({
  step,
  message,
  facts,
  isCurrent,
  isSent,
  anySent,
  open,
  onSent,
  onOutcome,
  caseId,
  nextReminder,
  now,
}: {
  step: LadderStep;
  message: Message;
  facts: CaseFacts;
  isCurrent: boolean;
  isSent: boolean;
  anySent: boolean;
  open: boolean;
  onSent: () => void;
  onOutcome: (outcome: Outcome) => void;
  caseId: string;
  nextReminder: LadderPosition["next"];
  now: Date;
}) {
  const [draft, setDraft] = useState<Message & { source: "template" | "ai" }>({ ...message, source: "template" });
  const [copied, setCopied] = useState(false);
  const [polishing, setPolishing] = useState<string | null>(null);

  async function copy() {
    await navigator.clipboard.writeText(step === 4 ? draft.body : `Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function polish() {
    setPolishing("Rewording…");
    try {
      const response = await fetch("/api/draft-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, facts }),
      });
      const json = (await response.json()) as { subject?: string; body?: string; source?: "ai" | "template"; error?: string };
      if (!response.ok || !json.body || !json.subject) throw new Error(json.error ?? "unavailable");
      setDraft({ subject: json.subject, body: json.body, source: json.source ?? "template" });
      setPolishing(json.source === "ai" ? null : "We kept the original wording so every number stays exact.");
    } catch {
      setPolishing("Rewording isn't available right now. The message below is ready to send as is.");
    }
  }

  function downloadReminder() {
    if (!nextReminder) return;
    const date = localIsoDate(nextReminder.at);
    const ics = reminderIcs({
      uid: `${caseId}-step-${nextReminder.step}`,
      date,
      title: `MoneyRecover: ${STEP_TITLES[nextReminder.step]} if ${formatUsd(facts.amountCents)} isn't repaid`,
      description: `Check whether payroll fixed your paycheck for ${periodLabel(facts)}. If not, open your case in MoneyRecover for the next message.`,
      createdAt: now,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "moneyrecover-reminder.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          Step {step}: {STEP_TITLES[step]}
        </h2>
        {draft.source === "ai" && <span className="text-xs text-muted">Reworded by AI · numbers checked against your case</span>}
      </div>
      {step !== 4 && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Subject:</span> {draft.subject}
        </p>
      )}
      <pre className="mt-3 max-h-[28rem] overflow-auto rounded-lg bg-paper p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</pre>
      {polishing && <p className="mt-2 text-xs text-muted" role="status">{polishing}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={copy}>{copied ? "Copied" : step === 4 ? "Copy guide" : "Copy message"}</Button>
        {step !== 4 && (
          <Button variant="secondary" onClick={polish} disabled={polishing === "Rewording…"}>
            Make it sound more like me
          </Button>
        )}
        {open && isCurrent && !isSent && (
          <Button variant="secondary" onClick={onSent} data-guide="mark-sent">
            {step === 4 ? "I filed a complaint" : "Mark as sent"}
          </Button>
        )}
      </div>

      {open && anySent && isCurrent && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm font-medium">What did payroll say?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onOutcome("promised_fix")}>
              They will fix it
            </Button>
            <Button variant="secondary" onClick={() => onOutcome("disagreed")}>
              They disagree
            </Button>
            <Button variant="secondary" onClick={() => onOutcome("no_response")}>
              No response yet
            </Button>
          </div>
          {nextReminder && (
            <button type="button" onClick={downloadReminder} className="mt-4 text-sm font-medium text-accent hover:underline">
              Add a reminder for {formatDate(localIsoDate(nextReminder.at))} to my calendar
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

const EVENT_LABELS: Record<CaseEvent["type"], string> = {
  opened: "Case opened",
  sent: "Message sent",
  promised_fix: "Payroll said they'll fix it",
  disagreed: "Payroll disagreed",
  no_response: "No response yet",
  recovered: "Money recovered, confirmed on a paycheck",
  paid_separately: "Money recovered, paid separately",
  closed: "Case closed",
};

function Timeline({ events }: { events: CaseEvent[] }) {
  return (
    <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium">
            {EVENT_LABELS[e.type]}
            {e.step && ` — step ${e.step}: ${STEP_TITLES[e.step]}`}
          </span>
          <span className="ml-2 text-muted">{formatDate(localIsoDate(new Date(e.at)))}</span>
          {e.note && <p className="text-muted">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
