"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, inputClass, Loading, PageTitle } from "@/components/ui";
import { saveSettings } from "@/lib/actions";
import { formatDate, localIsoDate, WEEKDAY_NAMES, type Weekday } from "@/lib/pay/dates";
import { formatUsd, parseUsd } from "@/lib/pay/money";
import { alignAnchor } from "@/lib/pay/periods";
import type { PayFrequency, Settings } from "@/lib/pay/types";
import { setState, useAppState, useNow } from "@/lib/store";

export default function SetupPage() {
  const state = useAppState();
  const now = useNow(state);
  if (!state) return <Loading />;
  return <SetupForm initial={state.settings} hasChecks={state.stubs.length > 0} today={localIsoDate(now)} />;
}

function SetupForm({ initial, hasChecks, today }: { initial: Settings | null; hasChecks: boolean; today: string }) {
  const router = useRouter();
  const [rate, setRate] = useState(initial ? formatUsd(initial.rateCents).slice(1) : "");
  const [frequency, setFrequency] = useState<PayFrequency>(initial?.frequency ?? "biweekly");
  const [weekStartsOn, setWeekStartsOn] = useState<Weekday>(initial?.weekStartsOn ?? 0);
  const [anchor, setAnchor] = useState(initial?.periodAnchor ?? alignAnchor(today, 0));
  const [submitted, setSubmitted] = useState(false);

  const rateCents = parseUsd(rate);
  const rateError = rateCents === null || rateCents <= 0 ? "Enter your hourly rate, for example 18.50" : null;
  const aligned = anchor ? alignAnchor(anchor, weekStartsOn) : null;
  const scheduleChanged =
    initial !== null &&
    aligned !== null &&
    (initial.frequency !== frequency || initial.weekStartsOn !== weekStartsOn || initial.periodAnchor !== aligned);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (rateError || !aligned || rateCents === null) return;
    setState((s) => saveSettings(s, { rateCents, frequency, weekStartsOn, periodAnchor: aligned }));
    router.push(initial ? "/app" : "/app/shifts");
  }

  return (
    <>
      <PageTitle title="Pay setup" subtitle="Four details about how you're paid. Takes under a minute." />
      <Card>
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
          <Field label="Hourly rate (USD)" htmlFor="rate" error={submitted ? rateError : null} hint="Your base rate before overtime.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
              <input
                id="rate"
                inputMode="decimal"
                className={`${inputClass} pl-7`}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                aria-invalid={submitted && !!rateError}
                placeholder="22.00"
              />
            </div>
          </Field>

          <Field label="Pay frequency" htmlFor="frequency" hint="Semi-monthly and monthly aren't supported yet.">
            <select id="frequency" className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as PayFrequency)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every two weeks (biweekly)</option>
            </select>
          </Field>

          <Field label="Your workweek starts on" htmlFor="week-start" hint="Overtime is counted per workweek. Sunday is most common.">
            <select
              id="week-start"
              className={inputClass}
              value={weekStartsOn}
              onChange={(e) => setWeekStartsOn(Number(e.target.value) as Weekday)}
            >
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Current pay period started on"
            htmlFor="anchor"
            hint={aligned && aligned !== anchor ? `Pay periods follow your workweek, so we'll use ${formatDate(aligned)}.` : "Already have a pay stub? Enter the period start date printed on it."}
          >
            <input id="anchor" type="date" className={inputClass} value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </Field>

          {scheduleChanged && hasChecks && (
            <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn sm:col-span-2">
              Changing your pay schedule clears paychecks you&apos;ve already checked and their cases, because the pay periods change. Your shifts are kept.
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit">{initial ? "Save changes" : "Continue to shifts"}</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
