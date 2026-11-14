import { describe, expect, it } from "vitest";
import { buyPlan, loadSample, skipDemoDays, startCase, submitStub, updateCase, appNow } from "./actions";
import { markSent } from "./case/ladder";
import { sampleGuide } from "./guide";
import { sampleRepaymentStub, sampleShortfallStub } from "./sample";

const realNow = new Date("2026-11-15T12:00:00");

describe("sample guide", () => {
  it("follows the sample from the first check to the recovered case", () => {
    let state = loadSample(realNow);
    const { shortfallPeriodId, repaymentPeriodId } = state.sample!;
    const now = () => appNow(state, realNow.getTime());
    const at = (path: string) => sampleGuide(state, path, now());

    expect(at("/app")).toMatchObject({ index: 1, target: "check-paycheck", href: null });
    expect(at("/app/shifts")).toMatchObject({ index: 1, href: "/app", target: null });
    expect(at(`/app/periods/${shortfallPeriodId}/check`)).toMatchObject({ index: 2, target: "run-check" });

    state = submitStub(state, sampleShortfallStub(shortfallPeriodId), now());
    expect(at(`/app/periods/${shortfallPeriodId}/result`)).toMatchObject({ index: 3, target: "start-case" });
    expect(at("/app/checkout")).toMatchObject({ index: 3, target: "unlock" });

    state = startCase(buyPlan(state, "case"), shortfallPeriodId, "c1", now());
    expect(at("/app/cases/c1")).toMatchObject({ index: 4, target: "mark-sent" });

    state = updateCase(state, "c1", (c) => markSent(c, 1, now()));
    expect(at("/app/cases/c1")).toMatchObject({ index: 5, target: "skip-days" });

    state = skipDemoDays(state, 7);
    expect(at("/app/cases/c1")).toMatchObject({ index: 6, target: "next-paycheck" });
    expect(at(`/app/periods/${repaymentPeriodId}/check`)).toMatchObject({ index: 7, target: "run-check" });

    state = submitStub(state, sampleRepaymentStub(repaymentPeriodId), now());
    expect(at("/app")).toMatchObject({ index: 7, finished: true });
  });

  it("stays out of the way for real users and once dismissed", () => {
    const sample = loadSample(realNow);
    expect(sampleGuide({ ...sample, sample: null }, "/app", realNow)).toBeNull();
    expect(sampleGuide({ ...sample, guideDismissed: true }, "/app", realNow)).toBeNull();
  });
});
