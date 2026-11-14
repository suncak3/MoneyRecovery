import { addDays } from "./pay/dates";

/** Builds a one-event iCalendar file (RFC 5545) for an all-day reminder. */

const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const compactDate = (isoDate: string) => isoDate.replaceAll("-", "");

/** Lines longer than 75 octets must be folded; ASCII keeps this simple. */
function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
  return parts.join("\r\n");
}

export type Reminder = { uid: string; date: string; title: string; description: string; createdAt: Date };

export function reminderIcs(reminder: Reminder): string {
  const stamp = reminder.createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MoneyRecover//Recovery reminders//EN",
    "BEGIN:VEVENT",
    `UID:${reminder.uid}@moneyrecover`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(reminder.date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(reminder.date, 1))}`,
    `SUMMARY:${escapeText(reminder.title)}`,
    `DESCRIPTION:${escapeText(reminder.description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT9H",
    `DESCRIPTION:${escapeText(reminder.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}
