import { describe, expect, it } from "vitest";
import { splitByWorkweek, shiftMinutes } from "./hours";
import { divRound, parseHoursToMinutes, parseUsd } from "./money";
import { payForWeeks, splitWeek } from "./overtime";
import { expectedFica } from "./taxes";

const week = (start: string, hours: number) => splitWeek(start, Math.round(hours * 60));
const pay = (rateCents: number, ...hoursPerWeek: number[]) =>
  payForWeeks(
    "p",
    hoursPerWeek.map((hours, i) => week(`2026-11-0${1 + i * 7}`, hours)),
    rateCents,
  );
const shift = (date: string, start: string, end: string, breakMin = 0) => ({ id: "s", date, start, end, breakMin });

describe("hours and pay (spec §6.5, cases 1–10)", () => {
  it("1. weekly 40.0 h @ $20.00", () => {
    const p = pay(2000, 40);
    expect([p.regMinutes, p.otMinutes, p.grossCents]).toEqual([2400, 0, 80_000]);
  });

  it("2. weekly 45.0 h @ $20.00", () => {
    const p = pay(2000, 45);
    expect([p.regMinutes, p.otMinutes, p.grossCents]).toEqual([2400, 300, 95_000]);
  });

  it("3. biweekly 45.0 + 35.0 h @ $22.00 — overtime is never averaged", () => {
    const p = pay(2200, 45, 35);
    expect([p.regMinutes, p.otMinutes, p.grossCents]).toEqual([4500, 300, 181_500]);
  });

  it("4. biweekly 40.0 + 40.0 h @ $22.00", () => {
    const p = pay(2200, 40, 40);
    expect([p.otMinutes, p.grossCents]).toEqual([0, 176_000]);
  });

  it("5. biweekly 50.0 + 50.0 h @ $20.00", () => {
    const p = pay(2000, 50, 50);
    expect([p.regMinutes, p.otMinutes, p.grossCents]).toEqual([4800, 1200, 220_000]);
  });

  it("6. shift 08:00–16:30 with a 30 min break", () => {
    expect(shiftMinutes(shift("2026-11-02", "08:00", "16:30", 30))).toBe(480);
  });

  it("7. overnight shift 22:00–06:00", () => {
    expect(shiftMinutes(shift("2026-11-02", "22:00", "06:00"))).toBe(480);
  });

  it("8. Sat 22:00–Sun 06:00 is split at the Sunday workweek boundary", () => {
    // 2026-11-07 is a Saturday.
    expect(splitByWorkweek(shift("2026-11-07", "22:00", "06:00"), 0)).toEqual([
      { weekStart: "2026-11-01", minutes: 120 },
      { weekStart: "2026-11-08", minutes: 360 },
    ]);
  });

  it("9. weekly 38.75 h @ $18.50 rounds 716.875 half up", () => {
    expect(pay(1850, 38.75).grossCents).toBe(71_688);
  });

  it("10. weekly 41.5 h @ $15.00", () => {
    const p = pay(1500, 41.5);
    expect([p.regPayCents, p.otPayCents, p.grossCents]).toEqual([60_000, 3375, 63_375]);
  });
});

describe("payroll taxes (cases 11–12)", () => {
  it("11. FICA wages $1,770.00", () => {
    const fica = expectedFica(177_000, []);
    expect([fica.ssCents, fica.medicareCents]).toEqual([10_974, 2567]);
  });

  it("12. 401(k) stays in FICA wages, a cafeteria-plan premium does not", () => {
    const fica = expectedFica(200_000, [
      { name: "401(k)", amountCents: 10_000, reducesFica: false },
      { name: "Health", amountCents: 5000, reducesFica: true },
    ]);
    expect(fica).toEqual({ wagesCents: 195_000, ssCents: 12_090, medicareCents: 2828 });
  });
});

describe("money helpers", () => {
  it("rounds half away from zero with integers only", () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
  });

  it("parses dollar strings without floating point", () => {
    expect(parseUsd("$1,451.80")).toBe(145_180);
    expect(parseUsd("55")).toBe(5500);
    expect(parseUsd(".5")).toBe(50);
    expect(parseUsd("12.345")).toBeNull();
    expect(parseUsd("")).toBeNull();
  });

  it("parses decimal hours into minutes", () => {
    expect(parseHoursToMinutes("80")).toBe(4800);
    expect(parseHoursToMinutes("38.75")).toBe(2325);
    expect(parseHoursToMinutes("abc")).toBeNull();
  });
});
