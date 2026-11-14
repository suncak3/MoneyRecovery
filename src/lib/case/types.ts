import type { FindingCode } from "../pay/types";

export type LadderStep = 1 | 2 | 3 | 4;

export type CaseStatus =
  | "draft"
  | "sent"
  | "awaiting_response"
  | "promised_fix"
  | "recovered"
  | "escalated"
  | "closed_unresolved";

export type CaseEventType =
  | "opened"
  | "sent"
  | "promised_fix"
  | "disagreed"
  | "no_response"
  | "recovered"
  | "paid_separately"
  | "closed";

export type CaseEvent = {
  /** ISO timestamp on the app clock (real time plus any demo offset). */
  at: string;
  type: CaseEventType;
  step?: LadderStep;
  note?: string;
};

export type RecoveryCase = {
  id: string;
  periodId: string;
  amountCents: number;
  causeCode: FindingCode;
  status: CaseStatus;
  /** Lowest step the case can be on. Time moves it up further; a disagreement raises it to 3. */
  step: LadderStep;
  events: CaseEvent[];
};

export const CLOSED_STATUSES: ReadonlySet<CaseStatus> = new Set(["recovered", "closed_unresolved"]);

export const isOpen = (c: RecoveryCase) => !CLOSED_STATUSES.has(c.status);

/** True when the repayment was found on a checked paycheck, false when the user reported it. */
export const isVerifiedRecovery = (c: RecoveryCase) =>
  c.status === "recovered" && c.events.some((e) => e.type === "recovered");
