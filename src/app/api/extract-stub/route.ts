import { NextResponse, type NextRequest } from "next/server";
import { extractedStubSchema } from "@/lib/extraction";
import { completeJson, LlmUnavailableError, type LlmImage } from "@/lib/llm";
import { clientIp, takeToken } from "@/lib/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set<LlmImage["mediaType"]>(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SYSTEM = `You read photos of US pay stubs and copy numbers from them. You never calculate, estimate or correct anything.

Copy the figures for the current pay period only, never year-to-date (YTD) columns. Return plain numbers without $ signs or commas. Use null for any field that is not clearly printed.

Fields:
- regHours, regPay: regular hours and regular earnings
- otHours, otPay: overtime hours and overtime earnings
- adjustment: retro pay, adjustment or correction earnings for an earlier period, if listed
- gross: gross pay for the period
- preTax: pre-tax deductions such as health, dental, vision, FSA, HSA, 401(k). Set reducesFica to true for health, dental, vision, FSA and HSA premiums (Section 125 plans) and false for 401(k), 403(b) and other retirement deferrals.
- ss: Social Security / OASDI tax withheld
- medicare: Medicare tax withheld
- fedTax: federal income tax withheld
- stateTax: state income tax withheld
- otherDeductions: total of any remaining after-tax deductions
- net: net pay

If the image is not a pay stub, return null for every number and an empty preTax list.`;

export async function POST(request: NextRequest) {
  if (!takeToken(`extract:${clientIp(request.headers)}`, 10)) {
    return NextResponse.json({ error: "Too many uploads. Please try again in a few minutes." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is larger than 5 MB." }, { status: 413 });
  if (!IMAGE_TYPES.has(file.type as LlmImage["mediaType"])) {
    return NextResponse.json({ error: "Please upload a JPEG, PNG, WebP or GIF image." }, { status: 415 });
  }

  try {
    // The image is held in memory for this request only and never written anywhere.
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const extracted = await completeJson({
      system: SYSTEM,
      prompt: "Copy the pay stub figures from this image.",
      image: { mediaType: file.type as LlmImage["mediaType"], base64 },
      schema: extractedStubSchema,
    });
    if (!extracted || (extracted.gross === null && extracted.net === null)) {
      return NextResponse.json({ error: "We couldn't find pay stub figures in that photo." }, { status: 422 });
    }
    return NextResponse.json(extracted);
  } catch (error) {
    if (error instanceof LlmUnavailableError) {
      return NextResponse.json({ error: "Photo reading isn't available right now." }, { status: 503 });
    }
    console.error("extract-stub failed", error);
    return NextResponse.json({ error: "We couldn't read that photo." }, { status: 502 });
  }
}
