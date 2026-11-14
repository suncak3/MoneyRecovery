import { describe, expect, it } from "vitest";
import { buyPlan, DAY_MS, homeTotals, loadSample, skipDemoDays, startCase, submitStub, updateCase, appNow } from "../actions";
import { expectedForPeriod } from "../check";
import { formatDate } from "../pay/dates";
import { sampleRepaymentStub, sampleShortfallStub } from "../sample";
import { caseFacts } from "./facts";
import { ladderPosition, markSent, recordOutcome } from "./ladder";
import { messageFor, missingFigures, requiredFragments } from "./templates";
import { findRepayment } from "./verify";
import type { RecoveryCase } from "./types";

const realNow = new Date("2026-11-14T12:00:00");

function openSampleCase() {
  let state = loadSample(realNow);
  const { shortfallPeriodId, repaymentPeriodId } = state.sample!;
  state = submitStub(state, sampleShortfallStub(shortfallPeriodId), realNow);
  state = startCase(buyPlan(state, "case"), shortfallPeriodId, "case-1", realNow);
  return { state, shortfallPeriodId, repaymentPeriodId };
}

const baseCase: RecoveryCase = {
  id: "c",
  periodId: "2026-10-18",
  amountCents: 5500,
  causeCode: "OT_AVERAGED_WEEKS",
  status: "draft",
  step: 1,
  events: [{ at: "2026-11-01T09:00:00.000Z", type: "opened" }],
};

describe("ladder", () => {
  const sentOn = new Date("2026-11-02T09:00:00.000Z");
  const sent = markSent(baseCase, 1, sentOn);
  const after = (days: number) => new Date(sentOn.getTime() + days * DAY_MS);

  it("stays on step 1 until the first message is sent", () => {
    expect(ladderPosition(baseCase, after(30)).step).toBe(1);
  });

  it("moves to follow-up after 7 days, formal request after 14, outside help after 21", () => {
    expect([0, 6, 7, 14, 21].map((d) => ladderPosition(sent, after(d)).step)).toEqual([1, 1, 2, 3, 4]);
  });

  it("jumps to the formal request when payroll disagrees", () => {
    const disagreed = recordOutcome(sent, "disagreed", after(2));
    expect(ladderPosition(disagreed, after(2))).toMatchObject({ step: 3 });
    expect(ladderPosition(disagreed, after(2)).reason).toContain("disagreed");
  });

  it("marks the case escalated once outside help is used", () => {
    expect(markSent(sent, 4, after(21)).status).toBe("escalated");
  });
});

describe("verification", () => {
  it("matches an adjustment line within the gross tolerance", () => {
    const stub = { periodId: "2026-11-01", grossCents: 181_550, adjustmentCents: 5550, preTax: [], netCents: 0 };
    expect(findRepayment(stub, 176_000, [baseCase])).toEqual({ caseId: "c", amountCents: 5550, source: "adjustment" });
  });

  it("matches gross above the period's expected pay when there is no adjustment line", () => {
    const stub = { periodId: "2026-11-01", grossCents: 181_500, preTax: [], netCents: 0 };
    expect(findRepayment(stub, 176_000, [baseCase])?.source).toBe("excess_gross");
  });

  it("ignores closed cases and cases from later periods", () => {
    const stub = { periodId: "2026-11-01", grossCents: 181_500, preTax: [], netCents: 0 };
    expect(findRepayment(stub, 176_000, [{ ...baseCase, status: "recovered" }])).toBeNull();
    expect(findRepayment(stub, 176_000, [{ ...baseCase, periodId: "2026-11-15" }])).toBeNull();
  });
});

describe("templates", () => {
  it("every step quotes the exact amount and period dates from the engine", () => {
    const { state, shortfallPeriodId } = openSampleCase();
    const facts = caseFacts(
      state.cases[0],
      "biweekly",
      expectedForPeriod({ settings: state.settings!, shifts: state.shifts }, shortfallPeriodId),
      state.stubs[0],
      realNow,
    );
    for (const step of [1, 2, 3, 4] as const) {
      const { body } = messageFor(step, facts);
      for (const fragment of requiredFragments(facts)) expect(body).toContain(fragment);
    }
    expect(messageFor(1, facts).body).toContain("- Overtime: 5.00 h × $33.00 = $165.00");
    expect(messageFor(1, facts).body).toContain(`Week of ${formatDate(shortfallPeriodId)}: 45.00 h (5.00 h over 40)`);
  });
});

describe("sample persona, end to end", () => {
  it("finds $55.00, walks the ladder with the demo clock, and is recovered by the next paycheck", () => {
    const opened = openSampleCase();
    const { repaymentPeriodId } = opened;
    let { state } = opened;
    const caseId = state.cases[0].id;
    expect(state.cases[0].amountCents).toBe(5500);
    expect(state.caseCredits).toBe(0);

    state = updateCase(state, caseId, (c) => markSent(c, 1, appNow(state, realNow.getTime())));
    state = skipDemoDays(state, 7);
    expect(ladderPosition(state.cases[0], appNow(state, realNow.getTime())).step).toBe(2);
    state = updateCase(state, caseId, (c) => recordOutcome(c, "promised_fix", appNow(state, realNow.getTime())));

    state = submitStub(state, sampleRepaymentStub(repaymentPeriodId), appNow(state, realNow.getTime()));
    const repaymentAudit = state.audits.find((a) => a.periodId === repaymentPeriodId)!;
    expect(repaymentAudit.verdict).toBe("match");
    expect(repaymentAudit.findings.map((f) => f.code)).toContain("REPAYMENT_RECEIVED");
    expect(state.cases[0].status).toBe("recovered");
    expect(homeTotals(state)).toEqual({ recoveredCents: 5500, openCases: 0, verifiedPaychecks: 1 });
  });
});

describe("rewrite verification", () => {
  const template = "Week of Oct 4, 2026: 45.00 h. Expected $1,815.00, paid $1,760.00, difference $55.00.";

  it("accepts a rewrite that keeps every figure", () => {
    const rewrite = "For the week of Oct 4, 2026 I worked 45.00 h. I expected $1,815.00 but got $1,760.00, so $55.00 is missing.";
    expect(missingFigures(template, rewrite)).toEqual([]);
  });

  it("reports figures that were dropped or changed", () => {
    const rewrite = "For the week of Oct 4, 2026 I worked 45 h. I expected $1,815 but got $1,760.00, so $55.00 is missing.";
    expect(missingFigures(template, rewrite)).toEqual(["$1,815.00", "45.00 h"]);
  });
});
