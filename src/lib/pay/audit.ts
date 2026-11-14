import { formatDate } from "./dates";
import { divRound, formatHours, formatUsd } from "./money";
import { overtimePay, regularPay, type ExpectedPay } from "./overtime";
import { expectedFica } from "./taxes";
import type { AuditLine, AuditResult, Finding, FindingCode, Stub, Verdict } from "./types";

export const GROSS_TOL = 100;
export const TAX_TOL = 5;
export const HOURS_TOL = 6;
export const RATE_TOL = 1;

export type AuditInput = {
  expected: ExpectedPay;
  stub: Stub;
  weeksInPeriod: number;
  /** The most recent stub checked before this one, used to spot new or larger deductions. */
  previousStub?: Stub | null;
  /**
   * Part of the stub's gross that pays back an earlier period (retro pay, a repaid case).
   * Defaults to the stub's adjustment line. It is excluded when comparing this period's pay.
   */
  priorPeriodCents?: number;
};

type GrossContext = {
  expected: ExpectedPay;
  stub: Stub;
  weeksInPeriod: number;
  currentGross: number;
  diff: number;
  stubTotalMinutes: number | undefined;
};

const h = (minutes: number) => `${formatHours(minutes)} h`;

function stubTotalMinutes(stub: Stub): number | undefined {
  if (stub.regMinutes === undefined && stub.otMinutes === undefined) return undefined;
  return (stub.regMinutes ?? 0) + (stub.otMinutes ?? 0);
}

function overtimeWeeksText(expected: ExpectedPay): string {
  return expected.weeks
    .filter((w) => w.otMinutes > 0)
    .map((w) => `the week of ${formatDate(w.weekStart)} had ${h(w.totalMinutes)} (${h(w.otMinutes)} over 40)`)
    .join(" and ");
}

/** Rate implied by the stub: the regular line if present, otherwise gross spread over straight-time-equivalent hours. */
function impliedRateCents(stub: Stub, currentGross: number): number | null {
  if (stub.regPayCents !== undefined && stub.regMinutes) {
    return divRound(stub.regPayCents * 60, stub.regMinutes);
  }
  const reg = stub.regMinutes ?? 0;
  const ot = stub.otMinutes ?? 0;
  const weighted = 2 * reg + 3 * ot;
  return weighted > 0 ? divRound(currentGross * 120, weighted) : null;
}

/** Finds the most likely reason gross pay is short. Rules are tried in order; the first match wins. */
function shortfallCause(ctx: GrossContext): Finding {
  const { expected, stub, weeksInPeriod, currentGross, diff } = ctx;
  const logged = expected.regMinutes + expected.otMinutes;
  const stubHours = ctx.stubTotalMinutes;
  const stubOt = stub.otMinutes ?? 0;
  const issue = (code: FindingCode, detail: string): Finding => ({
    code,
    severity: "issue",
    expectedCents: expected.grossCents,
    actualCents: currentGross,
    detail,
  });

  if (stubHours !== undefined && logged - stubHours > HOURS_TOL) {
    return issue(
      "HOURS_SHORT",
      `You logged ${h(logged)}, but the stub pays ${h(stubHours)}. The missing ${h(logged - stubHours)} account for most of the gap.`,
    );
  }

  const paidAsStraightTime =
    Math.abs(currentGross - regularPay(stubHours ?? logged, expected.rateCents)) <= GROSS_TOL;
  if (expected.otMinutes > 0 && stubOt === 0 && paidAsStraightTime) {
    const otRate = formatUsd(overtimePay(60, expected.rateCents));
    if (logged <= 40 * 60 * weeksInPeriod) {
      return issue(
        "OT_AVERAGED_WEEKS",
        `Your logged hours were ${h(logged)} in total, but ${overtimeWeeksText(expected)}. ` +
          `The stub pays every hour at ${formatUsd(expected.rateCents)}/h and no overtime, as if the weeks were averaged. ` +
          `Federal overtime is counted per workweek, so ${h(expected.otMinutes)} should be paid at ${otRate}/h.`,
      );
    }
    const weeks = overtimeWeeksText(expected);
    return issue(
      "OT_STRAIGHT_TIME",
      `${weeks[0].toUpperCase()}${weeks.slice(1)}, ` +
        `but all hours on the stub are paid at the regular ${formatUsd(expected.rateCents)}/h. ` +
        `Those ${h(expected.otMinutes)} should be paid at ${otRate}/h.`,
    );
  }

  if (stubOt > 0 && expected.otMinutes - stubOt > HOURS_TOL) {
    return issue(
      "OT_HOURS_SHORT",
      `You worked ${h(expected.otMinutes)} of overtime, but the stub pays ${h(stubOt)}.`,
    );
  }

  if (
    expected.otMinutes > 0 &&
    Math.abs(expected.otMinutes - stubOt) <= HOURS_TOL &&
    stub.otPayCents !== undefined &&
    overtimePay(stubOt, expected.rateCents) - stub.otPayCents > GROSS_TOL
  ) {
    return issue(
      "OT_RATE_LOW",
      `Overtime hours match (${h(stubOt)}), but overtime pay is ${formatUsd(stub.otPayCents)} instead of ` +
        `${formatUsd(overtimePay(stubOt, expected.rateCents))} at 1.5× your rate.`,
    );
  }

  const implied = impliedRateCents(stub, currentGross);
  if (
    stubHours !== undefined &&
    Math.abs(logged - stubHours) <= HOURS_TOL &&
    implied !== null &&
    expected.rateCents - implied > RATE_TOL
  ) {
    return issue(
      "RATE_MISMATCH",
      `Hours match, but the stub works out to ${formatUsd(implied)}/h instead of your ${formatUsd(expected.rateCents)}/h.`,
    );
  }

  return issue(
    "UNEXPLAINED_SHORTFALL",
    `Gross pay is ${formatUsd(diff)} lower than your log suggests and the stub does not show why. ` +
      `It is worth asking payroll for a line-by-line breakdown.`,
  );
}

function grossFindings(ctx: GrossContext): Finding[] {
  if (ctx.diff > GROSS_TOL) return [shortfallCause(ctx)];
  if (ctx.diff < -GROSS_TOL) {
    return [
      {
        code: "OVERPAID",
        severity: "issue",
        expectedCents: ctx.expected.grossCents,
        actualCents: ctx.currentGross,
        detail:
          `You were paid ${formatUsd(-ctx.diff)} more than your log suggests. ` +
          `Double-check your shifts; overpayments can be taken back later.`,
      },
    ];
  }
  return [];
}

function taxFindings(stub: Stub): Finding[] {
  const findings: Finding[] = [];
  const fica = expectedFica(stub.grossCents, stub.preTax);
  const wages = `${formatUsd(fica.wagesCents)} of FICA wages`;

  if (stub.ssCents !== undefined && Math.abs(stub.ssCents - fica.ssCents) > TAX_TOL) {
    findings.push({
      code: "FICA_SS_MISMATCH",
      severity: "issue",
      expectedCents: fica.ssCents,
      actualCents: stub.ssCents,
      detail: `Social Security should be 6.2% of ${wages} = ${formatUsd(fica.ssCents)}; the stub withholds ${formatUsd(stub.ssCents)}.`,
    });
  }
  if (stub.medicareCents !== undefined && Math.abs(stub.medicareCents - fica.medicareCents) > TAX_TOL) {
    findings.push({
      code: "FICA_MEDICARE_MISMATCH",
      severity: "issue",
      expectedCents: fica.medicareCents,
      actualCents: stub.medicareCents,
      detail: `Medicare should be 1.45% of ${wages} = ${formatUsd(fica.medicareCents)}; the stub withholds ${formatUsd(stub.medicareCents)}.`,
    });
  }

  const computedNet = stub.grossCents - totalDeductions(stub);
  if (Math.abs(computedNet - stub.netCents) > TAX_TOL) {
    findings.push({
      code: "NET_ARITHMETIC",
      severity: "issue",
      expectedCents: computedNet,
      actualCents: stub.netCents,
      detail:
        `Gross minus every deduction listed comes to ${formatUsd(computedNet)}, but net pay is ${formatUsd(stub.netCents)} ` +
        `(off by ${formatUsd(Math.abs(computedNet - stub.netCents))}). A deduction may be missing from the stub or from the form.`,
    });
  }
  return findings;
}

export function totalDeductions(stub: Stub): number {
  return (
    stub.preTax.reduce((sum, d) => sum + d.amountCents, 0) +
    (stub.ssCents ?? 0) +
    (stub.medicareCents ?? 0) +
    (stub.fedTaxCents ?? 0) +
    (stub.stateTaxCents ?? 0) +
    (stub.otherDeductionsCents ?? 0)
  );
}

const normalizeName = (name: string) => name.trim().toLowerCase();

function deductionFindings(stub: Stub, previous: Stub | null | undefined): Finding[] {
  if (!previous) return [];
  const before = new Map(previous.preTax.map((d) => [normalizeName(d.name), d.amountCents]));
  return stub.preTax.flatMap((d): Finding[] => {
    const old = before.get(normalizeName(d.name));
    if (old === undefined) {
      return [
        {
          code: "DEDUCTION_NEW",
          severity: "info",
          actualCents: d.amountCents,
          detail: `"${d.name}" (${formatUsd(d.amountCents)}) was not on your previous stub. Make sure you signed up for it.`,
        },
      ];
    }
    const increase = d.amountCents - old;
    if (increase > 500 && increase * 10 > old) {
      return [
        {
          code: "DEDUCTION_INCREASED",
          severity: "info",
          expectedCents: old,
          actualCents: d.amountCents,
          detail: `"${d.name}" went up from ${formatUsd(old)} to ${formatUsd(d.amountCents)} since your previous stub.`,
        },
      ];
    }
    return [];
  });
}

function auditLines(expected: ExpectedPay, stub: Stub, currentGross: number): AuditLine[] {
  const fica = expectedFica(stub.grossCents, stub.preTax);
  const lines: AuditLine[] = [
    { label: "Regular hours", unit: "hours", expected: expected.regMinutes, actual: stub.regMinutes ?? null },
    { label: "Regular pay", unit: "usd", expected: expected.regPayCents, actual: stub.regPayCents ?? null },
    { label: "Overtime hours", unit: "hours", expected: expected.otMinutes, actual: stub.otMinutes ?? null },
    { label: "Overtime pay", unit: "usd", expected: expected.otPayCents, actual: stub.otPayCents ?? null },
    { label: "Gross pay for this period", unit: "usd", expected: expected.grossCents, actual: currentGross },
  ];
  if (stub.ssCents !== undefined) {
    lines.push({ label: "Social Security (6.2%)", unit: "usd", expected: fica.ssCents, actual: stub.ssCents });
  }
  if (stub.medicareCents !== undefined) {
    lines.push({ label: "Medicare (1.45%)", unit: "usd", expected: fica.medicareCents, actual: stub.medicareCents });
  }
  lines.push({ label: "Net pay (stub arithmetic)", unit: "usd", expected: stub.grossCents - totalDeductions(stub), actual: stub.netCents });
  return lines;
}

export function auditPaycheck(input: AuditInput): AuditResult {
  const { expected, stub } = input;
  const prior = input.priorPeriodCents ?? stub.adjustmentCents ?? 0;
  const currentGross = stub.grossCents - prior;
  const diff = expected.grossCents - currentGross;

  const gross = grossFindings({
    expected,
    stub,
    weeksInPeriod: input.weeksInPeriod,
    currentGross,
    diff,
    stubTotalMinutes: stubTotalMinutes(stub),
  });
  const findings = [...gross, ...taxFindings(stub), ...deductionFindings(stub, input.previousStub)];

  let verdict: Verdict = "match";
  if (diff > GROSS_TOL) verdict = "shortfall";
  else if (diff < -GROSS_TOL) verdict = "overpaid";
  else if (findings.some((f) => f.severity === "issue")) verdict = "review";

  if (verdict === "match") {
    findings.unshift({
      code: "MATCH",
      severity: "info",
      expectedCents: expected.grossCents,
      actualCents: currentGross,
      detail: `Gross pay of ${formatUsd(currentGross)} matches your log of ${h(expected.regMinutes + expected.otMinutes)}.`,
    });
  }

  return {
    periodId: stub.periodId,
    verdict,
    shortfallCents: verdict === "shortfall" ? diff : 0,
    causeCode: gross[0]?.code ?? (verdict === "match" ? "MATCH" : null),
    findings,
    lines: auditLines(expected, stub, currentGross),
  };
}
