/** All money is integer cents, all time is integer minutes. Floats never touch money. */

/** Integer division rounded half away from zero, so 0.5 cent always rounds up for positive amounts. */
export function divRound(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) {
    throw new RangeError(`divRound needs safe integers and a non-zero denominator (${numerator}/${denominator})`);
  }
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  return sign * Math.floor((2 * n + d) / (2 * d));
}

/** Applies a rate given in basis points (6.2% = 620) to an amount in cents. */
export function applyBasisPoints(cents: number, basisPoints: number): number {
  return divRound(cents * basisPoints, 10_000);
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/** Parses "1,234.5" or "$55" into cents without going through floating point. Returns null if invalid. */
export function parseUsd(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  const match = /^(-?)(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match || (match[2] === "" && !match[3])) return null;
  const [, sign, whole, fraction = ""] = match;
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return sign ? -cents : cents;
}

/** Parses a decimal hour amount like "80" or "37.25" into whole minutes. */
export function parseHoursToMinutes(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  const scale = 10 ** fraction.length;
  return Number(whole) * 60 + divRound(Number(fraction || "0") * 60, scale);
}

export function formatHours(minutes: number, digits = 2): string {
  return (minutes / 60).toFixed(digits);
}
