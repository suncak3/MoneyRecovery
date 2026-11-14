import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { messageFor, missingFigures, type CaseFacts } from "@/lib/case/templates";
import { completeText, LlmUnavailableError } from "@/lib/llm";
import { FINDING_CODES } from "@/lib/pay/types";
import { clientIp, takeToken } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 20_000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int().nonnegative();

const factsSchema = z.object({
  periodStart: isoDate,
  periodEnd: isoDate,
  payday: isoDate.nullable(),
  rateCents: int,
  weeks: z.array(z.object({ weekStart: isoDate, totalMinutes: int, otMinutes: int })).max(2),
  regMinutes: int,
  regPayCents: int,
  otMinutes: int,
  otPayCents: int,
  expectedGrossCents: int,
  paidGrossCents: int,
  amountCents: int,
  causeCode: z.enum(FINDING_CODES),
  firstSentOn: isoDate.nullable(),
  today: isoDate,
}) satisfies z.ZodType<CaseFacts>;

const requestSchema = z.object({ step: z.union([z.literal(1), z.literal(2), z.literal(3)]), facts: factsSchema });

const SYSTEM = `You help an hourly worker write to their payroll department about a possible paycheck error.

Rewrite the draft so it sounds natural and personal, like a real employee wrote it. Rules:
- Keep every dollar amount, date and hour figure exactly as written, character for character.
- Keep the bullet list of hours and the calculation; you may adjust the wording around them.
- Stay calm, polite and factual. Assume an honest mistake. Never accuse, threaten or mention lawyers.
- Keep placeholders like [Your name] as they are.
- Do not add facts that are not in the draft.
Return only the message body, without a subject line.`;

export async function POST(request: NextRequest) {
  if (!takeToken(`draft:${clientIp(request.headers)}`, 20)) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // The template is rebuilt on the server from the facts, so the numbers always come from the engine.
  const template = messageFor(parsed.step, parsed.facts);
  const fallback = { ...template, source: "template" as const };

  try {
    const body = await completeText({ system: SYSTEM, prompt: `Draft:\n\n${template.body}` });
    if (!body || missingFigures(template.body, body).length > 0) return NextResponse.json(fallback);
    return NextResponse.json({ subject: template.subject, body, source: "ai" as const });
  } catch (error) {
    if (error instanceof LlmUnavailableError) {
      return NextResponse.json({ error: "Rewording isn't available right now." }, { status: 503 });
    }
    console.error("draft-message failed", error);
    return NextResponse.json(fallback);
  }
}
