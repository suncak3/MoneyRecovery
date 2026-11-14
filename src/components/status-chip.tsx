import type { CaseStatus } from "@/lib/case/types";
import type { PeriodStatus } from "@/lib/overview";
import { Chip } from "./ui";

const PERIOD_CHIPS: Record<PeriodStatus, { label: string; tone: "neutral" | "good" | "warn" | "alert" | "accent" }> = {
  in_progress: { label: "in progress", tone: "neutral" },
  needs_check: { label: "needs check", tone: "warn" },
  matches: { label: "matches", tone: "good" },
  review: { label: "worth a look", tone: "warn" },
  discrepancy: { label: "discrepancy", tone: "alert" },
  recovered: { label: "recovered", tone: "accent" },
};

export function PeriodStatusChip({ status }: { status: PeriodStatus }) {
  const chip = PERIOD_CHIPS[status];
  return <Chip tone={chip.tone}>{chip.label}</Chip>;
}

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  draft: "Ready to send",
  sent: "Message sent",
  awaiting_response: "Waiting for payroll",
  promised_fix: "Fix promised",
  recovered: "Recovered",
  escalated: "Outside help",
  closed_unresolved: "Closed",
};

export function CaseStatusChip({ status }: { status: CaseStatus }) {
  const tone = status === "recovered" ? "accent" : status === "closed_unresolved" ? "neutral" : status === "promised_fix" ? "good" : "warn";
  return <Chip tone={tone}>{CASE_STATUS_LABELS[status]}</Chip>;
}
