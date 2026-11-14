import { GROSS_TOL } from "../pay/audit";
import type { Stub } from "../pay/types";
import { isOpen, type RecoveryCase } from "./types";

export type Repayment = {
  caseId: string;
  amountCents: number;
  source: "adjustment" | "excess_gross";
};

/**
 * Looks for an earlier shortfall being paid back on a later stub: either an adjustment/retro
 * line, or gross pay above this period's expected gross, within GROSS_TOL of the case amount.
 */
export function findRepayment(stub: Stub, expectedGrossCents: number, cases: RecoveryCase[]): Repayment | null {
  const candidates = cases
    .filter((c) => isOpen(c) && c.periodId < stub.periodId)
    .sort((a, b) => a.periodId.localeCompare(b.periodId));
  const near = (amount: number, c: RecoveryCase) => Math.abs(amount - c.amountCents) <= GROSS_TOL;

  const adjustment = stub.adjustmentCents ?? 0;
  if (adjustment > 0) {
    const match = candidates.find((c) => near(adjustment, c));
    if (match) return { caseId: match.id, amountCents: adjustment, source: "adjustment" };
  }

  const excess = stub.grossCents - adjustment - expectedGrossCents;
  if (excess > GROSS_TOL) {
    const match = candidates.find((c) => near(excess, c));
    if (match) return { caseId: match.id, amountCents: excess, source: "excess_gross" };
  }

  return null;
}
