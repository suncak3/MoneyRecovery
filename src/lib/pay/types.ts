import type { Weekday } from "./dates";

export type PayFrequency = "weekly" | "biweekly";

export type Settings = {
  rateCents: number;
  frequency: PayFrequency;
  weekStartsOn: Weekday;
  /** ISO date of any pay period start; always falls on `weekStartsOn`. */
  periodAnchor: string;
};

export type Shift = {
  id: string;
  /** Date the shift starts on. */
  date: string;
  start: string;
  end: string;
  breakMin: number;
};

export type Deduction = { name: string; amountCents: number; reducesFica: boolean };

/** Figures copied from a pay stub. Optional fields are only checked when present. */
export type Stub = {
  periodId: string;
  regMinutes?: number;
  regPayCents?: number;
  otMinutes?: number;
  otPayCents?: number;
  adjustmentCents?: number;
  grossCents: number;
  preTax: Deduction[];
  ssCents?: number;
  medicareCents?: number;
  fedTaxCents?: number;
  stateTaxCents?: number;
  otherDeductionsCents?: number;
  netCents: number;
};

export type FindingCode =
  | "MATCH"
  | "HOURS_SHORT"
  | "OT_AVERAGED_WEEKS"
  | "OT_STRAIGHT_TIME"
  | "OT_HOURS_SHORT"
  | "OT_RATE_LOW"
  | "RATE_MISMATCH"
  | "UNEXPLAINED_SHORTFALL"
  | "OVERPAID"
  | "FICA_SS_MISMATCH"
  | "FICA_MEDICARE_MISMATCH"
  | "NET_ARITHMETIC"
  | "DEDUCTION_NEW"
  | "DEDUCTION_INCREASED"
  | "REPAYMENT_RECEIVED"
  | "ADJUSTMENT_UNMATCHED";

export type Finding = {
  code: FindingCode;
  severity: "info" | "issue";
  expectedCents?: number;
  actualCents?: number;
  detail: string;
};

export type AuditLine = {
  label: string;
  unit: "hours" | "usd";
  expected: number | null;
  actual: number | null;
};

export type Verdict = "match" | "shortfall" | "overpaid" | "review";

export type AuditResult = {
  periodId: string;
  verdict: Verdict;
  shortfallCents: number;
  /** The gross-pay finding that explains the verdict, if any. */
  causeCode: FindingCode | null;
  findings: Finding[];
  lines: AuditLine[];
};
