import { addDays, formatDate } from "../pay/dates";
import { formatHours, formatUsd } from "../pay/money";
import { overtimePay } from "../pay/overtime";
import type { FindingCode } from "../pay/types";
import type { LadderStep } from "./types";

/** Everything a message needs. All numbers come from the engine and are inserted verbatim. */
export type CaseFacts = {
  periodStart: string;
  periodEnd: string;
  payday: string | null;
  rateCents: number;
  weeks: { weekStart: string; totalMinutes: number; otMinutes: number }[];
  regMinutes: number;
  regPayCents: number;
  otMinutes: number;
  otPayCents: number;
  expectedGrossCents: number;
  paidGrossCents: number;
  amountCents: number;
  causeCode: FindingCode;
  /** Date the first message was sent, if it has been. */
  firstSentOn: string | null;
  today: string;
};

export type Message = { subject: string; body: string };

export const DOL_COMPLAINT_URL = "https://www.dol.gov/agencies/whd/contact/complaints";
export const DOL_HELPLINE = "1-866-487-9243";
export const STATE_AGENCIES_URL = "https://www.dol.gov/agencies/whd/state/contacts";

/** Days given to payroll in the formal request. */
export const CORRECTION_DAYS = 10;

const CAUSE_SENTENCES: Partial<Record<FindingCode, string>> = {
  OT_AVERAGED_WEEKS:
    "It looks like the two weeks may have been combined, so the overtime from the longer week was paid at the regular rate. Overtime is counted for each workweek separately.",
  OT_STRAIGHT_TIME: "It looks like my overtime hours may have been paid at the regular rate instead of time and a half.",
  OT_HOURS_SHORT: "It looks like fewer overtime hours were paid than I worked.",
  OT_RATE_LOW: "It looks like overtime may have been paid at less than 1.5 times my rate.",
  HOURS_SHORT: "It looks like fewer hours were paid than I worked.",
  RATE_MISMATCH: "It looks like the hourly rate used may be lower than my rate.",
};

const h = (minutes: number) => `${formatHours(minutes)} h`;

export function periodLabel(facts: Pick<CaseFacts, "periodStart" | "periodEnd">): string {
  return `${formatDate(facts.periodStart)} – ${formatDate(facts.periodEnd)}`;
}

function hoursList(facts: CaseFacts): string {
  return facts.weeks
    .map((w) => `- Week of ${formatDate(w.weekStart)}: ${h(w.totalMinutes)}${w.otMinutes > 0 ? ` (${h(w.otMinutes)} over 40)` : ""}`)
    .join("\n");
}

function calculation(facts: CaseFacts): string {
  const lines = [`- Regular: ${h(facts.regMinutes)} × ${formatUsd(facts.rateCents)} = ${formatUsd(facts.regPayCents)}`];
  if (facts.otMinutes > 0) {
    lines.push(
      `- Overtime: ${h(facts.otMinutes)} × ${formatUsd(overtimePay(60, facts.rateCents))} = ${formatUsd(facts.otPayCents)}`,
    );
  }
  lines.push(`- Expected gross: ${formatUsd(facts.expectedGrossCents)}`);
  lines.push(`- Gross on my pay stub: ${formatUsd(facts.paidGrossCents)}`);
  lines.push(`- Difference: ${formatUsd(facts.amountCents)}`);
  return lines.join("\n");
}

function causeSentence(facts: CaseFacts): string {
  return CAUSE_SENTENCES[facts.causeCode] ?? "I couldn't tell from the stub where the difference comes from.";
}

function friendlyCheck(facts: CaseFacts, period: string): Message {
  const paid = facts.payday ? ` (paid ${formatDate(facts.payday)})` : "";
  return {
    subject: `Question about my paycheck for ${period}`,
    body: `Hi,

I was going over my pay stub for ${period}${paid} and I think something may be off. It's probably just a mix-up, so I wanted to check with you.

My hours from my own records:
${hoursList(facts)}

At my rate of ${formatUsd(facts.rateCents)}/h:
${calculation(facts)}

${causeSentence(facts)}

Could you take a look? If my numbers are right, could the ${formatUsd(facts.amountCents)} be added to my next paycheck?

Thank you,
[Your name]`,
  };
}

function followUp(facts: CaseFacts, period: string): Message {
  const when = facts.firstSentOn ? `on ${formatDate(facts.firstSentOn)} ` : "";
  return {
    subject: `Following up: paycheck for ${period}`,
    body: `Hi,

I'm following up on the message I sent ${when}about my paycheck for ${period}. I haven't seen a correction yet, so I wanted to make sure it didn't get lost.

The short version: my records show ${formatUsd(facts.expectedGrossCents)} gross for that period and my stub shows ${formatUsd(facts.paidGrossCents)}, a difference of ${formatUsd(facts.amountCents)}. ${causeSentence(facts)}

I've attached a one-page summary of my shifts and the calculation. Could you let me know when this can be corrected?

Thanks,
[Your name]`,
  };
}

function formalRequest(facts: CaseFacts, period: string): Message {
  const raised = facts.firstSentOn ? `I first raised this on ${formatDate(facts.firstSentOn)}. ` : "";
  const deadline = formatDate(addDays(facts.today, CORRECTION_DAYS));
  return {
    subject: `Written request to correct wages for ${period}`,
    body: `To the payroll department,

I am writing to request a correction of my wages for the pay period ${period}. ${raised}As of ${formatDate(facts.today)}, the amount below has not been paid.

Hours worked:
${hoursList(facts)}

Calculation at ${formatUsd(facts.rateCents)}/h, with overtime counted per workweek at 1.5 times my rate:
${calculation(facts)}

I request that the ${formatUsd(facts.amountCents)} be paid no later than ${deadline}, either as a separate payment or as a clearly labelled line on my next paycheck. Please confirm in writing how and when this will be corrected. If you see the numbers differently, please send me the calculation you used.

I have kept a copy of this request and my records.

Sincerely,
[Your name]
[Employee ID, if you have one]`,
  };
}

function outsideHelp(facts: CaseFacts, period: string): Message {
  return {
    subject: `Filing a free wage complaint for ${period}`,
    body: `If payroll has not fixed this, you can ask the US Department of Labor's Wage and Hour Division (WHD) to look into it. It is free and confidential, and your employer may not retaliate against you for filing.

How to file:
1. Call ${DOL_HELPLINE} (1-866-4-USWAGE), Monday–Friday, 8:00 a.m.–4:30 p.m. local time, or visit a local WHD office.
2. Details and office finder: ${DOL_COMPLAINT_URL}
3. Have ready: your name, address and phone; the employer's name, address and phone; your manager's name; your job; how and when you are paid; and your pay stubs and the evidence page from this case.

Your state labor department is an alternative and may cover rules federal law does not: ${STATE_AGENCIES_URL}

Summary you can read out or paste:
I am an hourly worker paid ${formatUsd(facts.rateCents)}/h. For the pay period ${period} my records show:
${hoursList(facts)}
${calculation(facts)}
${facts.firstSentOn ? `I raised this with payroll in writing on ${formatDate(facts.firstSentOn)} and it has not been corrected.` : "I raised this with payroll and it has not been corrected."}`,
  };
}

export function messageFor(step: LadderStep, facts: CaseFacts): Message {
  const period = periodLabel(facts);
  switch (step) {
    case 1:
      return friendlyCheck(facts, period);
    case 2:
      return followUp(facts, period);
    case 3:
      return formalRequest(facts, period);
    case 4:
      return outsideHelp(facts, period);
  }
}

/** Strings a rewritten message must still contain word for word, or the template is used instead. */
export function requiredFragments(facts: CaseFacts): string[] {
  return [formatUsd(facts.amountCents), formatDate(facts.periodStart), formatDate(facts.periodEnd)];
}

const FIGURE_PATTERNS = [/\$[\d,]+\.\d{2}/g, /\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/g, /\b\d+\.\d{2} h\b/g];

/**
 * Every dollar amount, date and hour figure in the template that a rewrite dropped or changed.
 * A rewritten message is only used when this list is empty.
 */
export function missingFigures(template: string, rewritten: string): string[] {
  const figures = new Set(FIGURE_PATTERNS.flatMap((pattern) => template.match(pattern) ?? []));
  return [...figures].filter((figure) => !rewritten.includes(figure));
}
