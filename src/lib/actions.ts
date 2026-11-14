import { closeUnresolved, markRecovered, openCase } from "./case/ladder";
import { isOpen, type RecoveryCase } from "./case/types";
import { checkPaycheck } from "./check";
import { formatDate, localIsoDate } from "./pay/dates";
import { formatUsd } from "./pay/money";
import type { Settings, Shift, Stub } from "./pay/types";
import { buildSample } from "./sample";
import { emptyState, type AppState, type StoredAudit } from "./storage";

/** Pure state transitions. Components call these through the store and never touch pay math. */

export const DAY_MS = 86_400_000;

export function appNow(state: Pick<AppState, "demoClockOffsetDays">, realNow = Date.now()): Date {
  return new Date(realNow + state.demoClockOffsetDays * DAY_MS);
}

export function loadSample(realNow: Date): AppState {
  const sample = buildSample(localIsoDate(realNow));
  return { ...emptyState(), settings: sample.settings, shifts: sample.shifts, sample: sample.periods };
}

const samePeriodLayout = (a: Settings, b: Settings) =>
  a.frequency === b.frequency && a.weekStartsOn === b.weekStartsOn && a.periodAnchor === b.periodAnchor;

/** Changing the pay schedule invalidates checked paychecks and cases, because their period ids no longer exist. */
export function saveSettings(state: AppState, settings: Settings): AppState {
  if (state.settings && !samePeriodLayout(state.settings, settings)) {
    return refreshAudits({ ...state, settings, stubs: [], audits: [], cases: [], sample: null });
  }
  return refreshAudits({ ...state, settings });
}

export function upsertShift(state: AppState, shift: Shift): AppState {
  const shifts = state.shifts.some((s) => s.id === shift.id)
    ? state.shifts.map((s) => (s.id === shift.id ? shift : s))
    : [...state.shifts, shift];
  return refreshAudits({ ...state, shifts });
}

export function deleteShift(state: AppState, id: string): AppState {
  return refreshAudits({ ...state, shifts: state.shifts.filter((s) => s.id !== id) });
}

/** Re-runs every stored audit after shifts or the rate change, keeping repayments already matched. */
export function refreshAudits(state: AppState): AppState {
  const { settings } = state;
  if (!settings) return state;
  const audits = state.audits.map((stored): StoredAudit => {
    const stub = state.stubs.find((s) => s.periodId === stored.periodId);
    if (!stub) return stored;
    const { audit } = checkPaycheck({ ...state, settings }, stub, stored.repayment);
    return { ...audit, checkedAt: stored.checkedAt, repayment: stored.repayment };
  });
  return { ...state, audits };
}

export function submitStub(state: AppState, stub: Stub, now: Date): AppState {
  if (!state.settings) throw new Error("Set up your pay first");
  const { audit, repayment } = checkPaycheck({ ...state, settings: state.settings }, stub);
  const stored: StoredAudit = { ...audit, checkedAt: now.toISOString(), repayment };

  const cases = state.cases.map((c) =>
    repayment && c.id === repayment.caseId
      ? markRecovered(c, now, `${formatUsd(repayment.amountCents)} found on the paycheck for the period starting ${formatDate(stub.periodId)}.`)
      : c,
  );

  return {
    ...state,
    stubs: [...state.stubs.filter((s) => s.periodId !== stub.periodId), stub],
    audits: [...state.audits.filter((a) => a.periodId !== stub.periodId), stored],
    cases,
  };
}

export function canOpenCase(state: AppState): boolean {
  return state.plan === "protection" || state.caseCredits > 0;
}

export function buyPlan(state: AppState, plan: "case" | "protection"): AppState {
  return plan === "protection" ? { ...state, plan: "protection" } : { ...state, caseCredits: state.caseCredits + 1 };
}

export function startCase(state: AppState, periodId: string, id: string, now: Date): AppState {
  const existing = state.cases.find((c) => c.periodId === periodId);
  if (existing) return state;
  const audit = state.audits.find((a) => a.periodId === periodId);
  if (!audit) throw new Error(`No checked paycheck for ${periodId}`);
  if (!canOpenCase(state)) throw new Error("Recovery is locked");
  return {
    ...state,
    cases: [...state.cases, openCase(id, audit, now)],
    caseCredits: state.plan === "protection" ? state.caseCredits : state.caseCredits - 1,
  };
}

export function updateCase(state: AppState, id: string, change: (c: RecoveryCase) => RecoveryCase): AppState {
  return { ...state, cases: state.cases.map((c) => (c.id === id ? change(c) : c)) };
}

export function closeCase(state: AppState, id: string, now: Date): AppState {
  return updateCase(state, id, (c) => closeUnresolved(c, now));
}

export function skipDemoDays(state: AppState, days: number): AppState {
  return { ...state, demoClockOffsetDays: state.demoClockOffsetDays + days };
}

export type HomeTotals = { recoveredCents: number; openCases: number; verifiedPaychecks: number };

export function homeTotals(state: AppState): HomeTotals {
  return {
    recoveredCents: state.cases.filter((c) => c.status === "recovered").reduce((sum, c) => sum + c.amountCents, 0),
    openCases: state.cases.filter(isOpen).length,
    verifiedPaychecks: state.audits.filter((a) => a.verdict === "match").length,
  };
}
