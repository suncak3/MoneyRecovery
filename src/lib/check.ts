import { findRepayment, type Repayment } from "./case/verify";
import type { RecoveryCase } from "./case/types";
import { auditPaycheck } from "./pay/audit";
import { formatDate } from "./pay/dates";
import { formatUsd } from "./pay/money";
import { expectedPay, type ExpectedPay } from "./pay/overtime";
import { periodStarting, weeksPerPeriod } from "./pay/periods";
import type { AuditResult, Finding, Settings, Shift, Stub } from "./pay/types";

export type CheckContext = {
  settings: Settings;
  shifts: Shift[];
  stubs: Stub[];
  cases: RecoveryCase[];
};

export type CheckOutcome = {
  expected: ExpectedPay;
  audit: AuditResult;
  repayment: Repayment | null;
};

export function expectedForPeriod(ctx: Pick<CheckContext, "settings" | "shifts">, periodId: string): ExpectedPay {
  return expectedPay(ctx.shifts, periodStarting(periodId, ctx.settings.frequency), ctx.settings);
}

function previousStub(stubs: Stub[], periodId: string): Stub | null {
  return stubs.filter((s) => s.periodId < periodId).sort((a, b) => b.periodId.localeCompare(a.periodId))[0] ?? null;
}

function repaymentFinding(repayment: Repayment, cases: RecoveryCase[]): Finding {
  const repaidCase = cases.find((c) => c.id === repayment.caseId);
  const where = repayment.source === "adjustment" ? "an adjustment line" : "gross pay above this period's expected amount";
  return {
    code: "REPAYMENT_RECEIVED",
    severity: "info",
    expectedCents: repaidCase?.amountCents,
    actualCents: repayment.amountCents,
    detail:
      `This stub includes ${formatUsd(repayment.amountCents)} as ${where}, which matches your recovery case` +
      `${repaidCase ? ` for the period starting ${formatDate(repaidCase.periodId)}` : ""}.`,
  };
}

/**
 * Runs a paycheck through verification and the audit. Repayment is detected first so money
 * that pays back an earlier period is not mistaken for an overpayment of this one.
 * Pass `knownRepayment` to re-run an audit without re-matching cases (e.g. after editing shifts).
 */
export function checkPaycheck(ctx: CheckContext, stub: Stub, knownRepayment?: Repayment | null): CheckOutcome {
  const expected = expectedForPeriod(ctx, stub.periodId);
  const repayment = knownRepayment !== undefined ? knownRepayment : findRepayment(stub, expected.grossCents, ctx.cases);
  const adjustment = stub.adjustmentCents ?? 0;
  const excessRepaid = repayment?.source === "excess_gross" ? repayment.amountCents : 0;

  const audit = auditPaycheck({
    expected,
    stub,
    weeksInPeriod: weeksPerPeriod(ctx.settings.frequency),
    previousStub: previousStub(ctx.stubs, stub.periodId),
    priorPeriodCents: adjustment + excessRepaid,
  });

  if (repayment) {
    audit.findings.push(repaymentFinding(repayment, ctx.cases));
  } else if (adjustment > 0) {
    audit.findings.push({
      code: "ADJUSTMENT_UNMATCHED",
      severity: "info",
      actualCents: adjustment,
      detail:
        `The ${formatUsd(adjustment)} adjustment usually pays back an earlier period, so it is left out of this period's comparison. ` +
        `It does not match any open recovery case.`,
    });
  }

  return { expected, audit, repayment };
}
