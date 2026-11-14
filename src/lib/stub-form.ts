import { formatHours, parseHoursToMinutes, parseUsd } from "./pay/money";
import type { Stub } from "./pay/types";

/** The paycheck form keeps raw strings so the user can type freely; this module converts them both ways. */

export const MONEY_FIELDS = [
  "regPay",
  "otPay",
  "adjustment",
  "gross",
  "ss",
  "medicare",
  "fedTax",
  "stateTax",
  "otherDeductions",
  "net",
] as const;
export const HOUR_FIELDS = ["regHours", "otHours"] as const;

type MoneyField = (typeof MONEY_FIELDS)[number];
type HourField = (typeof HOUR_FIELDS)[number];

export type DeductionRow = { name: string; amount: string; reducesFica: boolean };
export type StubForm = Record<MoneyField | HourField, string> & { preTax: DeductionRow[] };
export type StubFormErrors = Partial<Record<MoneyField | HourField | "preTax", string>>;

export function emptyStubForm(): StubForm {
  return {
    regHours: "",
    regPay: "",
    otHours: "",
    otPay: "",
    adjustment: "",
    gross: "",
    ss: "",
    medicare: "",
    fedTax: "",
    stateTax: "",
    otherDeductions: "",
    net: "",
    preTax: [],
  };
}

const money = (cents: number | undefined) => (cents === undefined ? "" : (cents / 100).toFixed(2));
const hours = (minutes: number | undefined) => (minutes === undefined ? "" : formatHours(minutes));

export function stubToForm(stub: Stub): StubForm {
  return {
    regHours: hours(stub.regMinutes),
    regPay: money(stub.regPayCents),
    otHours: hours(stub.otMinutes),
    otPay: money(stub.otPayCents),
    adjustment: money(stub.adjustmentCents),
    gross: money(stub.grossCents),
    ss: money(stub.ssCents),
    medicare: money(stub.medicareCents),
    fedTax: money(stub.fedTaxCents),
    stateTax: money(stub.stateTaxCents),
    otherDeductions: money(stub.otherDeductionsCents),
    net: money(stub.netCents),
    preTax: stub.preTax.map((d) => ({ name: d.name, amount: money(d.amountCents), reducesFica: d.reducesFica })),
  };
}

const REQUIRED: ReadonlySet<string> = new Set(["gross", "net"]);

export type ParsedStubForm = { stub: Stub | null; errors: StubFormErrors };

export function parseStubForm(form: StubForm, periodId: string): ParsedStubForm {
  const errors: StubFormErrors = {};
  const values: Partial<Record<MoneyField | HourField, number>> = {};

  for (const field of MONEY_FIELDS) {
    const raw = form[field].trim();
    if (!raw) {
      if (REQUIRED.has(field)) errors[field] = "Required";
      continue;
    }
    const cents = parseUsd(raw);
    if (cents === null || cents < 0) errors[field] = "Enter an amount like 1,234.56";
    else values[field] = cents;
  }
  for (const field of HOUR_FIELDS) {
    const raw = form[field].trim();
    if (!raw) continue;
    const minutes = parseHoursToMinutes(raw);
    if (minutes === null) errors[field] = "Enter hours like 80 or 37.5";
    else values[field] = minutes;
  }

  const preTax = form.preTax
    .filter((row) => row.name.trim() || row.amount.trim())
    .map((row) => ({ name: row.name.trim() || "Pre-tax deduction", amountCents: parseUsd(row.amount), reducesFica: row.reducesFica }));
  if (preTax.some((d) => d.amountCents === null || d.amountCents < 0)) errors.preTax = "Each deduction needs an amount";

  if (Object.keys(errors).length > 0) return { stub: null, errors };

  return {
    errors,
    stub: {
      periodId,
      regMinutes: values.regHours,
      regPayCents: values.regPay,
      otMinutes: values.otHours,
      otPayCents: values.otPay,
      adjustmentCents: values.adjustment,
      grossCents: values.gross!,
      preTax: preTax.map((d) => ({ ...d, amountCents: d.amountCents! })),
      ssCents: values.ss,
      medicareCents: values.medicare,
      fedTaxCents: values.fedTax,
      stateTaxCents: values.stateTax,
      otherDeductionsCents: values.otherDeductions,
      netCents: values.net!,
    },
  };
}
