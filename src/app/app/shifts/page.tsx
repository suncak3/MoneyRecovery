"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { NeedsSetup } from "@/components/needs-setup";
import { PayBreakdown } from "@/components/pay-breakdown";
import { BackLink, Button, Card, Field, inputClass, Loading, PageTitle } from "@/components/ui";
import { WeekChart } from "@/components/week-chart";
import { deleteShift, upsertShift } from "@/lib/actions";
import { expectedForPeriod } from "@/lib/check";
import { addDays, formatDate, formatDayShort, localIsoDate } from "@/lib/pay/dates";
import { shiftMinutes } from "@/lib/pay/hours";
import { formatHours, formatUsd } from "@/lib/pay/money";
import { periodContaining, shiftPeriod, type PayPeriod } from "@/lib/pay/periods";
import { expectedFica } from "@/lib/pay/taxes";
import type { Settings, Shift } from "@/lib/pay/types";
import type { AppState } from "@/lib/storage";
import { setState, useAppState, useNow } from "@/lib/store";

export default function ShiftsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Shifts />
    </Suspense>
  );
}

function Shifts() {
  const state = useAppState();
  const now = useNow(state);
  const params = useSearchParams();
  if (!state) return <Loading />;
  if (!state.settings) return <NeedsSetup />;

  const today = localIsoDate(now);
  const period = periodContaining(params.get("period") ?? today, state.settings);
  return <PeriodShifts key={period.id} state={state} settings={state.settings} period={period} today={today} />;
}

function PeriodShifts({ state, settings, period, today }: { state: AppState; settings: Settings; period: PayPeriod; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Shift | null>(null);
  const shifts = state.shifts
    .filter((s) => s.date >= period.start && s.date <= period.end)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const expected = expectedForPeriod({ settings, shifts: state.shifts }, period.id);
  const fica = expectedFica(expected.grossCents, []);
  const go = (offset: number) => router.push(`/app/shifts?period=${shiftPeriod(period, settings.frequency, offset).id}`);
  const defaultDate = today >= period.start && today <= period.end ? today : period.start;

  return (
    <>
      <BackLink href="/app" className="mb-4">
        Home
      </BackLink>
      <PageTitle
        title="Shifts"
        subtitle={`Pay period ${formatDate(period.start)} – ${formatDate(period.end)}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => go(-1)} aria-label="Previous pay period">
              ← Earlier
            </Button>
            <Button variant="secondary" onClick={() => go(1)} aria-label="Next pay period">
              Later →
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-semibold">{editing ? "Edit shift" : "Add a shift"}</h2>
            <ShiftForm
              key={editing?.id ?? "new"}
              initial={editing}
              defaultDate={defaultDate}
              today={today}
              onSave={(shift) => {
                setState((s) => upsertShift(s, shift));
                setEditing(null);
              }}
              onCancel={editing ? () => setEditing(null) : undefined}
            />
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Logged shifts</h2>
            {shifts.length === 0 ? (
              <p className="text-sm text-muted">No shifts in this pay period yet. Add your first one above.</p>
            ) : (
              <ul className="divide-y divide-line">
                {shifts.map((shift) => (
                  <li key={shift.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{formatDayShort(shift.date)}</div>
                      <div className="tabular text-muted">
                        {shift.start}–{shift.end}
                        {shift.breakMin > 0 && ` · ${shift.breakMin} min break`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="tabular mr-2 font-medium">{formatHours(shiftMinutes(shift))} h</span>
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(shift)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-alert hover:bg-alert-soft"
                        onClick={() => setState((s) => deleteShift(s, shift.id))}
                        aria-label={`Delete shift on ${formatDayShort(shift.date)}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold">Expected pay for this period</h2>
              <span className="tabular text-2xl font-semibold">{formatUsd(expected.grossCents)}</span>
            </div>
            <PayBreakdown expected={expected} />
            <div className="mt-4 rounded-lg bg-paper p-3 text-xs text-muted">
              <p className="tabular">
                For reference, on this gross: Social Security {formatUsd(fica.ssCents)} (6.2%) · Medicare {formatUsd(fica.medicareCents)} (1.45%),
                before any pre-tax benefits.
              </p>
              <p className="mt-1">We don&apos;t estimate take-home pay because we don&apos;t check income tax withholding.</p>
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 font-semibold">Hours by workweek</h2>
            <WeekChart expected={expected} shifts={shifts} />
          </Card>
          <Link href={`/app/periods/${period.id}/check`} className="text-sm font-medium text-accent hover:underline">
            {period.end < today ? "This period is over. Check the paycheck for it →" : "Already have the pay stub for this period? Check it →"}
          </Link>
        </div>
      </div>
    </>
  );
}

function ShiftForm({
  initial,
  defaultDate,
  today,
  onSave,
  onCancel,
}: {
  initial: Shift | null;
  defaultDate: string;
  today: string;
  onSave: (shift: Shift) => void;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [start, setStart] = useState(initial?.start ?? "09:00");
  const [end, setEnd] = useState(initial?.end ?? "17:30");
  const [breakMin, setBreakMin] = useState(String(initial?.breakMin ?? 30));

  const breakValue = /^\d{1,3}$/.test(breakMin) ? Number(breakMin) : null;
  const valid = date && start && end && breakValue !== null;
  const preview = valid ? shiftMinutes({ id: "", date, start, end, breakMin: breakValue }) : null;
  const overnight = valid && end <= start;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || breakValue === null) return;
    onSave({ id: initial?.id ?? crypto.randomUUID(), date, start, end, breakMin: breakValue });
    if (!initial) setDate(addDays(date, 1));
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Field label="Date" htmlFor="shift-date" hint={date > today ? "This date is in the future. That's fine for a planned shift." : undefined}>
          <input id="shift-date" type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Start" htmlFor="shift-start">
        <input id="shift-start" type="time" required className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="End" htmlFor="shift-end" hint={overnight ? "Ends the next day" : undefined}>
        <input id="shift-end" type="time" required className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Field label="Unpaid break (minutes)" htmlFor="shift-break">
        <input
          id="shift-break"
          inputMode="numeric"
          className={inputClass}
          value={breakMin}
          onChange={(e) => setBreakMin(e.target.value)}
          aria-invalid={breakValue === null}
        />
      </Field>
      <div className="flex flex-col justify-end pb-2.5 text-sm text-muted">
        {preview !== null && (
          <span>
            Paid time: <strong className="tabular text-ink">{formatHours(preview)} h</strong>
          </span>
        )}
      </div>
      <div className="col-span-2 flex gap-2">
        <Button type="submit" disabled={!valid}>
          {initial ? "Save shift" : "Add shift"}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
