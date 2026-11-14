"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NeedsSetup } from "@/components/needs-setup";
import { StubUpload } from "@/components/stub-upload";
import { Button, Card, Field, inputClass, Loading, PageTitle } from "@/components/ui";
import { submitStub } from "@/lib/actions";
import { checkPaycheck, expectedForPeriod } from "@/lib/check";
import { formatDate } from "@/lib/pay/dates";
import { formatUsd } from "@/lib/pay/money";
import { periodContaining, type PayPeriod } from "@/lib/pay/periods";
import type { Settings } from "@/lib/pay/types";
import { sampleRepaymentStub, sampleShortfallStub, SAMPLE_NAME } from "@/lib/sample";
import type { AppState } from "@/lib/storage";
import { setState, useAppState, useNow } from "@/lib/store";
import { emptyStubForm, parseStubForm, stubToForm, type StubForm, type StubFormErrors } from "@/lib/stub-form";

export default function CheckPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAppState();
  const now = useNow(state);
  if (!state) return <Loading />;
  if (!state.settings) return <NeedsSetup />;

  const period = periodContaining(id, state.settings);
  if (period.id !== id) return <p className="text-muted">That pay period doesn&apos;t exist for your pay schedule.</p>;
  return <CheckForm key={id} state={state} settings={state.settings} period={period} now={now} />;
}

function initialForm(state: AppState, periodId: string): { form: StubForm; source: "saved" | "sample" | null } {
  const saved = state.stubs.find((s) => s.periodId === periodId);
  if (saved) return { form: stubToForm(saved), source: "saved" };
  if (state.sample?.shortfallPeriodId === periodId) return { form: stubToForm(sampleShortfallStub(periodId)), source: "sample" };
  if (state.sample?.repaymentPeriodId === periodId) return { form: stubToForm(sampleRepaymentStub(periodId)), source: "sample" };
  return { form: emptyStubForm(), source: null };
}

function CheckForm({ state, settings, period, now }: { state: AppState; settings: Settings; period: PayPeriod; now: Date }) {
  const router = useRouter();
  const initial = initialForm(state, period.id);
  const [form, setForm] = useState<StubForm>(initial.form);
  const [source, setSource] = useState<string | null>(
    initial.source === "sample" ? `Pre-filled with ${SAMPLE_NAME}'s pay stub. Review the numbers, then run the check.` : null,
  );
  const [showErrors, setShowErrors] = useState(false);

  const parsed = parseStubForm(form, period.id);
  const errors: StubFormErrors = showErrors ? parsed.errors : {};
  const expected = expectedForPeriod({ settings, shifts: state.shifts }, period.id);
  const preview = parsed.stub ? checkPaycheck({ ...state, settings }, parsed.stub).audit : null;

  const set = (field: keyof Omit<StubForm, "preTax">) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!parsed.stub) return;
    const stub = parsed.stub;
    setState((s) => submitStub(s, stub, now));
    router.push(`/app/periods/${period.id}/result`);
  }

  const money = (field: keyof Omit<StubForm, "preTax">, label: string, hint?: string) => (
    <Field label={label} htmlFor={field} error={errors[field]} hint={hint}>
      <input id={field} inputMode="decimal" className={inputClass} value={form[field]} onChange={set(field)} aria-invalid={!!errors[field]} placeholder="0.00" />
    </Field>
  );

  return (
    <>
      <PageTitle title="Check your paycheck" subtitle={`Pay period ${formatDate(period.start)} – ${formatDate(period.end)}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <Card>
            <StubUpload
              onExtracted={(next) => {
                setForm(next);
                setSource("Filled in from your photo. Check every number against the stub before running the check.");
              }}
            />
            {source && <p className="mt-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-strong">{source}</p>}
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">Earnings</h2>
            <p className="mb-4 text-sm text-muted">Only gross and net pay are required. Every other line is checked when you fill it in.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {money("regHours", "Regular hours")}
              {money("regPay", "Regular pay ($)")}
              {money("otHours", "Overtime hours")}
              {money("otPay", "Overtime pay ($)")}
              {money("adjustment", "Adjustment / retro pay ($)", "Money for an earlier period, if listed.")}
              {money("gross", "Gross pay ($) *")}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">Pre-tax deductions</h2>
            <p className="mb-4 text-sm text-muted">
              Health, dental and vision premiums usually lower FICA wages. 401(k) contributions don&apos;t.
            </p>
            <DeductionRows form={form} setForm={setForm} error={errors.preTax} />
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold">Taxes and net pay</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {money("ss", "Social Security ($)")}
              {money("medicare", "Medicare ($)")}
              {money("fedTax", "Federal income tax ($)", "Recorded, not checked.")}
              {money("stateTax", "State income tax ($)", "Recorded, not checked.")}
              {money("otherDeductions", "Other deductions, total ($)")}
              {money("net", "Net pay ($) *")}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" data-guide="run-check">
              Run the check
            </Button>
            {showErrors && !parsed.stub && <span className="text-sm text-alert">Fix the highlighted fields first.</span>}
          </div>
        </form>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="text-sm font-medium text-muted">Live comparison</h2>
            <dl className="tabular mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt>Your log says</dt>
                <dd className="font-medium">{formatUsd(expected.grossCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Stub gross</dt>
                <dd className="font-medium">{parsed.stub ? formatUsd(parsed.stub.grossCents - (parsed.stub.adjustmentCents ?? 0)) : "—"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm">
              {preview ? <PreviewVerdict verdict={preview.verdict} shortfallCents={preview.shortfallCents} /> : <span className="text-muted">Enter gross and net pay to see a first result.</span>}
            </p>
            <p className="mt-3 text-xs text-muted">Change any number and the comparison updates. Nothing is saved until you run the check.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function PreviewVerdict({ verdict, shortfallCents }: { verdict: string; shortfallCents: number }) {
  if (verdict === "shortfall") return <span className="font-semibold text-alert">Possible shortfall: {formatUsd(shortfallCents)}</span>;
  if (verdict === "overpaid") return <span className="font-semibold text-warn">Paid more than your log</span>;
  if (verdict === "review") return <span className="font-semibold text-warn">Gross matches; a deduction is worth a look</span>;
  return <span className="font-semibold text-accent">Looks like a match</span>;
}

function DeductionRows({ form, setForm, error }: { form: StubForm; setForm: React.Dispatch<React.SetStateAction<StubForm>>; error?: string }) {
  const update = (index: number, patch: Partial<StubForm["preTax"][number]>) =>
    setForm((f) => ({ ...f, preTax: f.preTax.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));

  return (
    <div className="flex flex-col gap-3">
      {form.preTax.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 sm:grid-cols-[1fr_8rem_auto_auto]">
          <input aria-label="Deduction name" className={inputClass} value={row.name} placeholder="Health insurance" onChange={(e) => update(i, { name: e.target.value })} />
          <input aria-label="Amount" inputMode="decimal" className={inputClass} value={row.amount} placeholder="0.00" onChange={(e) => update(i, { amount: e.target.value })} />
          <button
            type="button"
            aria-label="Remove deduction"
            className="rounded-md px-2 py-2 text-muted hover:text-alert"
            onClick={() => setForm((f) => ({ ...f, preTax: f.preTax.filter((_, j) => j !== i) }))}
          >
            ✕
          </button>
          <label className="col-span-3 flex items-center gap-2 text-sm text-muted sm:col-span-1 sm:row-start-1 sm:col-start-3">
            <input type="checkbox" checked={row.reducesFica} onChange={(e) => update(i, { reducesFica: e.target.checked })} />
            Lowers FICA wages
          </label>
        </div>
      ))}
      {error && <p className="text-xs text-alert">{error}</p>}
      <div>
        <Button variant="secondary" onClick={() => setForm((f) => ({ ...f, preTax: [...f.preTax, { name: "", amount: "", reducesFica: true }] }))}>
          + Add a deduction
        </Button>
      </div>
    </div>
  );
}
