import type { RecoveryCase } from "./case/types";
import { expectedForPeriod } from "./check";
import type { ExpectedPay } from "./pay/overtime";
import { periodContaining, type PayPeriod } from "./pay/periods";
import type { AppState, StoredAudit } from "./storage";

export type PeriodStatus = "in_progress" | "needs_check" | "matches" | "review" | "discrepancy" | "recovered";

export type PeriodSummary = {
  period: PayPeriod;
  status: PeriodStatus;
  expected: ExpectedPay;
  audit: StoredAudit | null;
  recoveryCase: RecoveryCase | null;
};

function statusOf(period: PayPeriod, today: string, audit: StoredAudit | null, c: RecoveryCase | null): PeriodStatus {
  if (c?.status === "recovered") return "recovered";
  if (audit) {
    if (audit.verdict === "match") return "matches";
    if (audit.verdict === "review") return "review";
    return "discrepancy";
  }
  return period.end >= today ? "in_progress" : "needs_check";
}

/** Every period with shifts or a checked stub, plus the current one, newest first. */
export function periodSummaries(state: AppState, today: string): PeriodSummary[] {
  const { settings } = state;
  if (!settings) return [];

  const ids = new Set<string>([periodContaining(today, settings).id]);
  for (const shift of state.shifts) ids.add(periodContaining(shift.date, settings).id);
  for (const stub of state.stubs) ids.add(stub.periodId);

  return [...ids]
    .sort((a, b) => b.localeCompare(a))
    .map((id) => {
      const period = periodContaining(id, settings);
      const audit = state.audits.find((a) => a.periodId === id) ?? null;
      const recoveryCase = state.cases.find((c) => c.periodId === id) ?? null;
      return {
        period,
        status: statusOf(period, today, audit, recoveryCase),
        expected: expectedForPeriod({ settings, shifts: state.shifts }, id),
        audit,
        recoveryCase,
      };
    });
}
