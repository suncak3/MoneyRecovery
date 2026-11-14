import type { FindingCode } from "./types";

/** One-line, non-accusatory explanation shown next to each finding. */
export const FINDING_TITLES: Record<FindingCode, string> = {
  MATCH: "Paycheck matches your log.",
  HOURS_SHORT: "Fewer hours were paid than you logged.",
  OT_AVERAGED_WEEKS: "Overtime looks averaged across two weeks instead of counted per week.",
  OT_STRAIGHT_TIME: "Overtime hours look paid at the regular rate.",
  OT_HOURS_SHORT: "Fewer overtime hours were paid than you worked.",
  OT_RATE_LOW: "Overtime was paid below 1.5× your rate.",
  RATE_MISMATCH: "The hourly rate on the stub is lower than your rate.",
  UNEXPLAINED_SHORTFALL: "Gross pay is lower than expected; worth asking payroll for a breakdown.",
  OVERPAID: "You were paid more than your log suggests.",
  FICA_SS_MISMATCH: "Social Security withheld doesn't match 6.2% of FICA wages.",
  FICA_MEDICARE_MISMATCH: "Medicare withheld doesn't match 1.45% of FICA wages.",
  NET_ARITHMETIC: "Net pay doesn't add up from the lines on the stub.",
  DEDUCTION_NEW: "New deduction since your last paycheck.",
  DEDUCTION_INCREASED: "A deduction went up since your last paycheck.",
  REPAYMENT_RECEIVED: "Repayment of an earlier shortfall found.",
  ADJUSTMENT_UNMATCHED: "Adjustment line not linked to an open case.",
};
