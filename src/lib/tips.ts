/** One short intro per screen, shown the first time someone opens it. */

export type Tip = { title: string; points: string[] };

export type Section = "home" | "shifts" | "setup" | "check" | "result" | "checkout" | "case" | "evidence";

export const TIPS: Record<Section, Tip> = {
  home: {
    title: "Your home screen",
    points: [
      "The top numbers are what matters: money recovered, open cases, and paychecks confirmed correct.",
      "When a pay period ends, a card asks if the paycheck arrived. That's your cue to check it.",
      "Every pay period is listed below with its status: in progress, needs check, matches, discrepancy or recovered.",
    ],
  },
  shifts: {
    title: "Your shift log",
    points: [
      "Add each shift: date, start, end and unpaid break. Overnight shifts are fine.",
      "On the right you see what this pay period should pay, updated as you type.",
      "Overtime is counted per workweek: hours over 40 in a week are paid at 1.5×, never averaged across weeks.",
    ],
  },
  setup: {
    title: "How you're paid",
    points: [
      "Your hourly rate and how often you're paid let us work out what each paycheck should be.",
      "The day your workweek starts matters for overtime. Check your pay stub or ask payroll if unsure.",
    ],
  },
  check: {
    title: "Check a paycheck",
    points: [
      "Copy the numbers from your pay stub. Only gross and net pay are required; every extra line gets checked too.",
      "Or upload a photo and we fill the form in for you to review.",
      "The box on the right compares the stub with your shifts as you type.",
    ],
  },
  result: {
    title: "The result",
    points: [
      "The banner tells you if the paycheck matches your shifts or comes up short, and by how much.",
      "Probable cause explains the likely reason in plain English, with the numbers behind it.",
      "If money is missing, a Recovery Case helps you get it back step by step.",
    ],
  },
  checkout: {
    title: "Recovery is the paid part",
    points: [
      "Logging shifts and checking paychecks stay free.",
      "A Recovery Case is $9, or $5.99 a month for unlimited cases.",
      "This is a demo checkout: nothing is charged.",
    ],
  },
  case: {
    title: "Your Recovery Case",
    points: [
      "Four steps, from a friendly message to outside help. The current one is highlighted and its message is ready to copy.",
      "You send messages yourself. Mark each one as sent and tell us what payroll said, so we know what comes next.",
      "Check your next paycheck when it arrives: if the money is there, the case closes as recovered.",
    ],
  },
  evidence: {
    title: "Your evidence page",
    points: [
      "Your shifts, the calculation and the stub figures on one page.",
      "Print it or save it as a PDF and attach it to your message to payroll.",
    ],
  },
};

export function sectionOf(pathname: string): Section | null {
  if (pathname === "/app") return "home";
  if (pathname.startsWith("/app/shifts")) return "shifts";
  if (pathname.startsWith("/app/setup")) return "setup";
  if (pathname.startsWith("/app/checkout")) return "checkout";
  if (/^\/app\/periods\/[^/]+\/check$/.test(pathname)) return "check";
  if (/^\/app\/periods\/[^/]+\/result$/.test(pathname)) return "result";
  if (/^\/app\/cases\/[^/]+\/evidence$/.test(pathname)) return "evidence";
  if (/^\/app\/cases\/[^/]+$/.test(pathname)) return "case";
  return null;
}
