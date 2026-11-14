import { describe, expect, it } from "vitest";
import { buildSample, sampleShortfallStub } from "../sample";
import { auditPaycheck } from "./audit";
import { expectedPay, payForWeeks, splitWeek } from "./overtime";
import { periodStarting } from "./periods";
import type { Stub } from "./types";

const weekly40At20 = payForWeeks("p", [splitWeek("2026-11-01", 2400)], 2000);

/** A stub whose taxes and net are internally consistent unless overridden. */
function stub(grossCents: number, extra: Partial<Stub> = {}): Stub {
  return { periodId: "p", grossCents, preTax: [], netCents: grossCents, ...extra };
}

const codes = (result: ReturnType<typeof auditPaycheck>) => result.findings.map((f) => f.code);

describe("audit (spec §6.5, cases 13–20)", () => {
  it("13. sample persona: overtime averaged across weeks, $55.00 short, taxes consistent", () => {
    const sample = buildSample("2026-11-14");
    const period = periodStarting(sample.periods.shortfallPeriodId, "biweekly");
    const expected = expectedPay(sample.shifts, period, sample.settings);
    expect(expected.grossCents).toBe(181_500);

    const result = auditPaycheck({ expected, stub: sampleShortfallStub(period.id), weeksInPeriod: 2 });
    expect(result.verdict).toBe("shortfall");
    expect(result.causeCode).toBe("OT_AVERAGED_WEEKS");
    expect(result.shortfallCents).toBe(5500);
    expect(codes(result)).toEqual(["OT_AVERAGED_WEEKS"]);
  });

  it("14. fewer hours paid than logged", () => {
    const result = auditPaycheck({ expected: weekly40At20, stub: stub(76_000, { regMinutes: 38 * 60 }), weeksInPeriod: 1 });
    expect(result.causeCode).toBe("HOURS_SHORT");
    expect(result.shortfallCents).toBe(4000);
  });

  it("15. overtime hours paid at the regular rate", () => {
    const expected = payForWeeks("p", [splitWeek("2026-11-01", 45 * 60)], 2000);
    const result = auditPaycheck({ expected, stub: stub(90_000, { regMinutes: 45 * 60, otMinutes: 0 }), weeksInPeriod: 1 });
    expect(result.causeCode).toBe("OT_STRAIGHT_TIME");
    expect(result.shortfallCents).toBe(5000);
  });

  it("16. hourly rate on the stub is lower", () => {
    const result = auditPaycheck({ expected: weekly40At20, stub: stub(78_000, { regMinutes: 2400 }), weeksInPeriod: 1 });
    expect(result.causeCode).toBe("RATE_MISMATCH");
    expect(result.findings[0].detail).toContain("$19.50/h");
    expect(result.shortfallCents).toBe(2000);
  });

  it("17. Social Security withheld does not match 6.2% of FICA wages", () => {
    const result = auditPaycheck({ expected: weekly40At20, stub: stub(80_000, { ssCents: 5500, netCents: 74_500 }), weeksInPeriod: 1 });
    const finding = result.findings.find((f) => f.code === "FICA_SS_MISMATCH");
    expect(finding?.expectedCents).toBe(4960);
    expect(result.verdict).toBe("review");
  });

  it("18. net pay does not add up", () => {
    const result = auditPaycheck({ expected: weekly40At20, stub: stub(80_000, { fedTaxCents: 15_000, netCents: 64_000 }), weeksInPeriod: 1 });
    const finding = result.findings.find((f) => f.code === "NET_ARITHMETIC");
    expect(finding).toBeDefined();
    expect(Math.abs(finding!.expectedCents! - finding!.actualCents!)).toBe(1000);
  });

  it("19. a correct paycheck matches", () => {
    const result = auditPaycheck({
      expected: weekly40At20,
      stub: stub(80_000, { regMinutes: 2400, ssCents: 4960, medicareCents: 1160, netCents: 73_880 }),
      weeksInPeriod: 1,
    });
    expect(result.verdict).toBe("match");
    expect(codes(result)).toEqual(["MATCH"]);
  });

  it("20. overpaid by $50.00", () => {
    const result = auditPaycheck({ expected: weekly40At20, stub: stub(85_000), weeksInPeriod: 1 });
    expect(result.verdict).toBe("overpaid");
    expect(result.findings[0]).toMatchObject({ code: "OVERPAID", expectedCents: 80_000, actualCents: 85_000 });
    expect(result.shortfallCents).toBe(0);
  });
});

describe("audit details", () => {
  it("excludes an adjustment line from this period's comparison", () => {
    const result = auditPaycheck({ expected: weekly40At20, stub: stub(85_500, { adjustmentCents: 5500 }), weeksInPeriod: 1 });
    expect(result.verdict).toBe("match");
  });

  it("flags a new pre-tax deduction compared with the previous stub", () => {
    const previous = stub(80_000);
    const current = stub(80_000, { preTax: [{ name: "Vision", amountCents: 800, reducesFica: true }], netCents: 79_200 });
    const result = auditPaycheck({ expected: weekly40At20, stub: current, weeksInPeriod: 1, previousStub: previous });
    expect(codes(result)).toContain("DEDUCTION_NEW");
    expect(result.verdict).toBe("match");
  });

  it("flags a deduction that grew by more than 10% and $5", () => {
    const health = (amountCents: number) => [{ name: "Health", amountCents, reducesFica: true }];
    const result = auditPaycheck({
      expected: weekly40At20,
      stub: stub(80_000, { preTax: health(6000), netCents: 74_000 }),
      previousStub: stub(80_000, { preTax: health(4500) }),
      weeksInPeriod: 1,
    });
    expect(codes(result)).toContain("DEDUCTION_INCREASED");
  });

  it("reports overtime paid below time and a half", () => {
    const expected = payForWeeks("p", [splitWeek("2026-11-01", 45 * 60)], 2000);
    const result = auditPaycheck({
      expected,
      stub: stub(90_000 + 2500, { regMinutes: 2400, otMinutes: 300, otPayCents: 12_500 }),
      weeksInPeriod: 1,
    });
    expect(result.causeCode).toBe("OT_RATE_LOW");
  });
});
