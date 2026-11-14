import { z } from "zod";
import { emptyStubForm, type StubForm } from "./stub-form";

/** What /api/extract-stub returns: plain numbers as printed on the stub, null when not found. */
const amount = z.number().nullable();

export const extractedStubSchema = z.object({
  regHours: amount,
  regPay: amount,
  otHours: amount,
  otPay: amount,
  adjustment: amount,
  gross: amount,
  preTax: z.array(z.object({ name: z.string(), amount: z.number(), reducesFica: z.boolean() })),
  ss: amount,
  medicare: amount,
  fedTax: amount,
  stateTax: amount,
  otherDeductions: amount,
  net: amount,
});

export type ExtractedStub = z.infer<typeof extractedStubSchema>;

const text = (value: number | null, digits: number) => (value === null ? "" : value.toFixed(digits));

export function extractionToForm(data: ExtractedStub): StubForm {
  return {
    ...emptyStubForm(),
    regHours: text(data.regHours, 2),
    regPay: text(data.regPay, 2),
    otHours: text(data.otHours, 2),
    otPay: text(data.otPay, 2),
    adjustment: text(data.adjustment, 2),
    gross: text(data.gross, 2),
    ss: text(data.ss, 2),
    medicare: text(data.medicare, 2),
    fedTax: text(data.fedTax, 2),
    stateTax: text(data.stateTax, 2),
    otherDeductions: text(data.otherDeductions, 2),
    net: text(data.net, 2),
    preTax: data.preTax.map((d) => ({ name: d.name, amount: d.amount.toFixed(2), reducesFica: d.reducesFica })),
  };
}
