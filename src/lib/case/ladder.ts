import type { AuditResult } from "../pay/types";
import { isOpen, type CaseEvent, type LadderStep, type RecoveryCase } from "./types";

const DAY_MS = 86_400_000;

/** Days after the first message is sent when each later step becomes current. */
export const STEP_DUE_AFTER_DAYS: Record<LadderStep, number> = { 1: 0, 2: 7, 3: 14, 4: 21 };

export const STEP_TITLES: Record<LadderStep, string> = {
  1: "Friendly check",
  2: "Follow-up",
  3: "Formal written request",
  4: "Outside help",
};

export type LadderPosition = {
  step: LadderStep;
  /** Why this step is current, in plain English. */
  reason: string;
  /** When the following step becomes current if nothing changes. */
  next: { step: LadderStep; at: Date } | null;
  sentSteps: LadderStep[];
};

const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

export function firstMessageSentAt(c: RecoveryCase): Date | null {
  const event = c.events.find((e) => e.type === "sent" && e.step === 1);
  return event ? new Date(event.at) : null;
}

function stepByTime(daysSinceFirst: number): LadderStep {
  if (daysSinceFirst >= STEP_DUE_AFTER_DAYS[4]) return 4;
  if (daysSinceFirst >= STEP_DUE_AFTER_DAYS[3]) return 3;
  if (daysSinceFirst >= STEP_DUE_AFTER_DAYS[2]) return 2;
  return 1;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ladderPosition(c: RecoveryCase, now: Date): LadderPosition {
  const sentSteps = [...new Set(c.events.filter((e) => e.type === "sent").map((e) => e.step!))].sort();
  const firstSent = firstMessageSentAt(c);

  if (!firstSent) {
    return {
      step: c.step,
      reason: "Your case is open. Most payroll errors are honest mistakes, so the first step is a friendly message.",
      next: null,
      sentSteps,
    };
  }

  const days = daysBetween(firstSent, now);
  const timeStep = stepByTime(days);
  const step = Math.max(c.step, timeStep) as LadderStep;
  const next =
    step < 4 && isOpen(c)
      ? { step: (step + 1) as LadderStep, at: new Date(firstSent.getTime() + STEP_DUE_AFTER_DAYS[(step + 1) as LadderStep] * DAY_MS) }
      : null;

  let reason: string;
  if (c.step > timeStep) {
    reason = "Payroll disagreed with your numbers. A formal written request puts the calculation on record.";
  } else if (step === 1) {
    reason = `You sent the first message ${days === 0 ? "today" : `${plural(days, "day")} ago`}. Give payroll a week to respond or fix it.`;
  } else {
    reason = `It has been ${plural(days, "day")} since your first message and the shortfall has not been repaid yet.`;
  }

  return { step, reason, next, sentSteps };
}

function withEvent(c: RecoveryCase, event: CaseEvent, patch: Partial<RecoveryCase>): RecoveryCase {
  return { ...c, ...patch, events: [...c.events, event] };
}

export function openCase(id: string, audit: AuditResult, now: Date): RecoveryCase {
  if (audit.verdict !== "shortfall" || !audit.causeCode) {
    throw new Error("A recovery case needs an audit with a shortfall");
  }
  return {
    id,
    periodId: audit.periodId,
    amountCents: audit.shortfallCents,
    causeCode: audit.causeCode,
    status: "draft",
    step: 1,
    events: [{ at: now.toISOString(), type: "opened" }],
  };
}

export function markSent(c: RecoveryCase, step: LadderStep, now: Date): RecoveryCase {
  return withEvent(
    c,
    { at: now.toISOString(), type: "sent", step },
    { status: step === 4 ? "escalated" : "sent" },
  );
}

export type Outcome = "promised_fix" | "disagreed" | "no_response";

export function recordOutcome(c: RecoveryCase, outcome: Outcome, now: Date): RecoveryCase {
  const event: CaseEvent = { at: now.toISOString(), type: outcome };
  if (outcome === "promised_fix") return withEvent(c, event, { status: "promised_fix" });
  if (outcome === "disagreed") {
    return withEvent(c, event, { status: "awaiting_response", step: Math.max(c.step, 3) as LadderStep });
  }
  return withEvent(c, event, { status: c.status === "escalated" ? "escalated" : "awaiting_response" });
}

export function markRecovered(c: RecoveryCase, now: Date, note: string): RecoveryCase {
  return withEvent(c, { at: now.toISOString(), type: "recovered", note }, { status: "recovered" });
}

/** Repaid outside payroll (a separate check or transfer), so no paycheck will ever show it. */
export function markPaidSeparately(c: RecoveryCase, now: Date): RecoveryCase {
  return withEvent(
    c,
    { at: now.toISOString(), type: "paid_separately", note: "You reported the money was paid outside your paycheck." },
    { status: "recovered" },
  );
}

export function closeUnresolved(c: RecoveryCase, now: Date): RecoveryCase {
  return withEvent(c, { at: now.toISOString(), type: "closed" }, { status: "closed_unresolved" });
}
