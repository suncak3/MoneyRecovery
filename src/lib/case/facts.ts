import { localIsoDate } from "../pay/dates";
import type { ExpectedPay } from "../pay/overtime";
import { assumedPayday, periodStarting } from "../pay/periods";
import type { PayFrequency, Stub } from "../pay/types";
import { firstMessageSentAt } from "./ladder";
import type { CaseFacts } from "./templates";
import type { RecoveryCase } from "./types";

export function caseFacts(
  c: RecoveryCase,
  frequency: PayFrequency,
  expected: ExpectedPay,
  stub: Stub,
  now: Date,
): CaseFacts {
  const period = periodStarting(c.periodId, frequency);
  const firstSent = firstMessageSentAt(c);
  return {
    periodStart: period.start,
    periodEnd: period.end,
    payday: assumedPayday(period),
    rateCents: expected.rateCents,
    weeks: expected.weeks,
    regMinutes: expected.regMinutes,
    regPayCents: expected.regPayCents,
    otMinutes: expected.otMinutes,
    otPayCents: expected.otPayCents,
    expectedGrossCents: expected.grossCents,
    paidGrossCents: stub.grossCents - (stub.adjustmentCents ?? 0),
    amountCents: c.amountCents,
    causeCode: c.causeCode,
    firstSentOn: firstSent ? localIsoDate(firstSent) : null,
    today: localIsoDate(now),
  };
}
