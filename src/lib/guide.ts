import { ladderPosition } from "./case/ladder";
import type { AppState } from "./storage";

/**
 * The sample tour. The current step is derived from the data, not from page visits,
 * so the guide stays right even when someone wanders off the script.
 */

export type GuideStep = {
  index: number;
  total: number;
  text: string;
  /** Where the next action is. Null when it's on this page or the tour is over. */
  href: string | null;
  /** `data-guide` value of the control to highlight on this page. */
  target: string | null;
  finished: boolean;
};

const TOTAL = 7;

export function sampleGuide(state: AppState, pathname: string, now: Date): GuideStep | null {
  if (!state.sample || state.guideDismissed) return null;
  const { shortfallPeriodId, repaymentPeriodId } = state.sample;
  const checkPath = `/app/periods/${shortfallPeriodId}/check`;
  const resultPath = `/app/periods/${shortfallPeriodId}/result`;
  const repaymentCheckPath = `/app/periods/${repaymentPeriodId}/check`;

  const step = (index: number, text: string, href: string, target: string): GuideStep => ({
    index,
    total: TOTAL,
    text,
    href: pathname === href ? null : href,
    target: pathname === href ? target : null,
    finished: false,
  });

  const audit = state.audits.find((a) => a.periodId === shortfallPeriodId);
  if (!audit) {
    if (pathname === checkPath) {
      return step(2, "This is Maria's real pay stub, already typed in: 80 hours at $22.00 and no overtime. Run the check.", checkPath, "run-check");
    }
    return step(
      1,
      "Maria worked 45 hours one week and 35 the next. Her shifts say she should get $1,815.00. Let's compare that with her pay stub.",
      "/app",
      "check-paycheck",
    );
  }

  const recoveryCase = state.cases.find((c) => c.periodId === shortfallPeriodId);
  if (!recoveryCase) {
    if (pathname === "/app/checkout") {
      return step(3, "This is what MoneyRecover sells: help getting the money back. In the demo nothing is charged. Unlock it.", "/app/checkout", "unlock");
    }
    return step(
      3,
      "$55.00 is missing: payroll averaged the two weeks, so 5 overtime hours were paid at the regular rate. Start a Recovery Case to get it back.",
      resultPath,
      "start-case",
    );
  }

  const casePath = `/app/cases/${recoveryCase.id}`;
  if (recoveryCase.status === "recovered") {
    return { index: TOTAL, total: TOTAL, text: "Done: $55.00 found, asked for and paid back. That's the whole loop MoneyRecover runs for you.", href: null, target: null, finished: true };
  }

  const position = ladderPosition(recoveryCase, now);
  if (!position.sentSteps.includes(1)) {
    return step(4, "Step 1 is a friendly, ready-to-send message for payroll. Maria would copy it into an email. Then mark it as sent.", casePath, "mark-sent");
  }
  if (position.step === 1) {
    return step(5, "In real life Maria would wait a week for an answer. Use the demo control to skip ahead 7 days.", casePath, "skip-days");
  }
  if (pathname === repaymentCheckPath) {
    return step(7, "Her next paycheck includes $55.00 of retro pay. Run the check and watch the case close itself.", repaymentCheckPath, "run-check");
  }
  return step(
    6,
    "A week passed, so the follow-up message is ready. Suppose payroll fixed it: check Maria's next paycheck.",
    casePath,
    "next-paycheck",
  );
}
