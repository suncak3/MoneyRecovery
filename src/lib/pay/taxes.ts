import { applyBasisPoints } from "./money";
import type { Deduction } from "./types";

/** Employee share of FICA (IRS Publication 15). */
export const SOCIAL_SECURITY_BP = 620;
export const MEDICARE_BP = 145;

/**
 * Wages subject to FICA: gross minus pre-tax deductions that are excluded from FICA
 * (Section 125 cafeteria-plan premiums). 401(k) deferrals are still FICA wages.
 */
export function ficaWages(grossCents: number, preTax: Deduction[]): number {
  const excluded = preTax.filter((d) => d.reducesFica).reduce((sum, d) => sum + d.amountCents, 0);
  return grossCents - excluded;
}

export type FicaAmounts = { wagesCents: number; ssCents: number; medicareCents: number };

export function expectedFica(grossCents: number, preTax: Deduction[]): FicaAmounts {
  const wagesCents = ficaWages(grossCents, preTax);
  return {
    wagesCents,
    ssCents: applyBasisPoints(wagesCents, SOCIAL_SECURITY_BP),
    medicareCents: applyBasisPoints(wagesCents, MEDICARE_BP),
  };
}
