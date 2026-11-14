import { z } from "zod";
import { FINDING_CODES } from "./pay/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const cents = z.number().int();
const minutes = z.number().int().nonnegative();

const settingsSchema = z.object({
  rateCents: cents.positive(),
  frequency: z.enum(["weekly", "biweekly"]),
  weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  periodAnchor: isoDate,
});

const shiftSchema = z.object({
  id: z.string(),
  date: isoDate,
  start: clock,
  end: clock,
  breakMin: minutes,
});

const deductionSchema = z.object({ name: z.string(), amountCents: cents.nonnegative(), reducesFica: z.boolean() });

export const stubSchema = z.object({
  periodId: isoDate,
  regMinutes: minutes.optional(),
  regPayCents: cents.optional(),
  otMinutes: minutes.optional(),
  otPayCents: cents.optional(),
  adjustmentCents: cents.optional(),
  grossCents: cents,
  preTax: z.array(deductionSchema),
  ssCents: cents.optional(),
  medicareCents: cents.optional(),
  fedTaxCents: cents.optional(),
  stateTaxCents: cents.optional(),
  otherDeductionsCents: cents.optional(),
  netCents: cents,
});

const findingCode = z.enum(FINDING_CODES);

const findingSchema = z.object({
  code: findingCode,
  severity: z.enum(["info", "issue"]),
  expectedCents: cents.optional(),
  actualCents: cents.optional(),
  detail: z.string(),
});

const auditSchema = z.object({
  periodId: isoDate,
  verdict: z.enum(["match", "shortfall", "overpaid", "review"]),
  shortfallCents: cents,
  causeCode: findingCode.nullable(),
  findings: z.array(findingSchema),
  lines: z.array(
    z.object({
      label: z.string(),
      unit: z.enum(["hours", "usd"]),
      expected: z.number().nullable(),
      actual: z.number().nullable(),
    }),
  ),
  checkedAt: z.string(),
  repayment: z
    .object({ caseId: z.string(), amountCents: cents, source: z.enum(["adjustment", "excess_gross"]) })
    .nullable(),
});

const step = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const caseSchema = z.object({
  id: z.string(),
  periodId: isoDate,
  amountCents: cents.positive(),
  causeCode: findingCode,
  status: z.enum(["draft", "sent", "awaiting_response", "promised_fix", "recovered", "escalated", "closed_unresolved"]),
  step,
  events: z.array(
    z.object({
      at: z.string(),
      type: z.enum(["opened", "sent", "promised_fix", "disagreed", "no_response", "recovered", "closed"]),
      step: step.optional(),
      note: z.string().optional(),
    }),
  ),
});

export const appStateSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema.nullable(),
  shifts: z.array(shiftSchema),
  stubs: z.array(stubSchema),
  audits: z.array(auditSchema),
  cases: z.array(caseSchema),
  /** Demo checkout: "protection" unlocks every case, otherwise each case uses one credit. */
  plan: z.enum(["protection"]).nullable(),
  caseCredits: z.number().int().nonnegative(),
  demoClockOffsetDays: z.number().int().nonnegative(),
  sample: z.object({ shortfallPeriodId: isoDate, repaymentPeriodId: isoDate }).nullable(),
  /** Onboarding: the sample tour can be hidden, and each screen's intro shows once. */
  guideDismissed: z.boolean().default(false),
  seenTips: z.array(z.string()).default([]),
});

export const STORAGE_KEY = "moneyrecover:v1";

export type AppState = z.infer<typeof appStateSchema>;
export type StoredAudit = AppState["audits"][number];

export function emptyState(): AppState {
  return {
    version: 1,
    settings: null,
    shifts: [],
    stubs: [],
    audits: [],
    cases: [],
    plan: null,
    caseCredits: 0,
    demoClockOffsetDays: 0,
    sample: null,
    guideDismissed: false,
    seenTips: [],
  };
}

/** Missing, unreadable or invalid data falls back to an empty state instead of breaking the app. */
export function parseState(raw: string | null): AppState {
  if (!raw) return emptyState();
  try {
    const result = appStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : emptyState();
  } catch {
    return emptyState();
  }
}
