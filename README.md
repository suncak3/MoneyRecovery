# MoneyRecover

**Log your shifts, know what your paycheck should be, and when it comes up short, get the money back step by step.**

**Live: [moneyrecovery.vercel.app](https://moneyrecovery.vercel.app/)** · Web only · No sign-up · Your data stays in your browser

Built in 24 hours for the Zimran Business Cup.

## Try it in two minutes

Open the app and press **Try with a sample**. A guided tour walks through the whole loop with Maria, a warehouse associate paid $22.00/h every two weeks:

1. Maria worked 45 hours one week and 35 the next, so her shifts say she earned **$1,815.00** gross.
2. **Check the paycheck.** Her stub pays all 80 hours at the regular rate. The check finds **$55.00 missing**: payroll averaged the two weeks, so 5 overtime hours were paid at $22.00 instead of $33.00.
3. **Start a Recovery Case** (the checkout is a demo, nothing is charged) and send the friendly first message to payroll.
4. **Skip 7 days** with the demo clock. The follow-up message is now the current step.
5. **Check her next paycheck.** It includes $55.00 of retro pay, and the case closes itself as **recovered**.

Every number along the way comes from the deterministic pay engine in `src/lib/pay`, not from an AI model.

## The problem

Our user is a US hourly worker, 25–45, whose schedule changes every week (warehouse, retail, restaurant, delivery) and who is paid weekly or biweekly.

- Hours change every week, so it is hard to tell whether a paycheck is right.
- Payroll mistakes are common: 43% of US employees had a paycheck error in the past year, and 57% of them caught the latest one themselves ([Paychex Employee Compensation Confidence Index, 2026](https://www.paychex.com/articles/payroll-taxes/catching-payroll-errors)).
- Raising it with payroll without numbers is uncomfortable, so small shortfalls are rarely recovered.

Shift trackers and paycheck calculators already exist, but they stop at "you were shorted $55". MoneyRecover is built around what happens next: a **Recovery Case** that takes the worker from evidence to a confirmed repayment. Tracking is the input; recovery is the product.

## What it does

1. **Shift log.** Start, end and unpaid break for each shift, with expected gross pay updated live. Overtime is counted per workweek, and a chart shows each week against the 40-hour line. Overnight shifts are supported.
2. **Paycheck check.** Type in the figures from the pay stub, or upload a photo to pre-fill them. You get a line-by-line comparison, the probable cause in plain English and the numbers behind it. A paycheck can be checked before the pay period ends.
3. **Recovery Case.** A printable evidence page and a four-step message ladder, each step with a ready-to-send message:
   1. Friendly check (right away)
   2. Follow-up (after 7 days)
   3. Formal written request (after 14 days, or immediately if payroll disagrees)
   4. Outside help: how to file with the US Department of Labor or a state agency (after 21 days)

   The case records payroll's response, adds calendar reminders (.ics) for the next step and verifies repayment automatically: when a later paycheck includes the missing amount, the case closes as **recovered**. Money repaid outside payroll can be marked by hand.
4. **Home screen.** Leads with *Recovered so far*, *Open cases* and *Paychecks verified*, then the paycheck that needs checking and the current pay period.

**Pricing.** Logging shifts and checking paychecks are free. Recovery is **$3.99 per case** or **$5.99/month** for unlimited cases. In this build the checkout is a clearly labelled demo and charges nothing.

## How the check works

All time is kept in whole minutes and all money in whole cents, so floating-point errors never touch pay. Each line is rounded half up exactly once.

| Rule | Where | Source |
|---|---|---|
| Overtime is every hour over 40 in a workweek, paid at 1.5× the regular rate | `pay/overtime.ts` | [DOL Fact Sheet #23](https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay) |
| Each workweek stands alone; hours are never averaged across weeks | `weeklyTotals` in `pay/overtime.ts` | [29 CFR 778.104](https://www.ecfr.gov/current/title-29/section-778.104) |
| A workweek is a fixed, recurring 168-hour period; a shift that crosses the boundary is split | `splitByWorkweek` in `pay/hours.ts` | [29 CFR 778.105](https://www.ecfr.gov/current/title-29/section-778.105) |
| Social Security is 6.2% and Medicare 1.45% of FICA wages | `pay/taxes.ts` | [IRS Publication 15](https://www.irs.gov/publications/p15) |
| Section 125 premiums (health, dental, vision) reduce FICA wages; 401(k) deferrals don't | `ficaWages` in `pay/taxes.ts` | [IRS Publication 15-B](https://www.irs.gov/publications/p15b) |

- **Pay formulas.** Regular pay = `round(regular minutes × rate / 60)`. Overtime pay = `round(overtime minutes × rate × 3 / 120)`.
- **Shifts across a week boundary.** The unpaid break is shared in proportion to the time on each side, because the stub doesn't say when the break was taken.
- **Taxes** are checked against the gross printed on the stub, so the check tests whether the stub is internally consistent. Income tax is recorded but never judged.
- **Tolerances.** Gross pay $1.00, taxes $0.05, hours 6 minutes, hourly rate $0.01.
- **Probable cause** of a shortfall. Rules are tried in this order, and the first match wins:
  1. `HOURS_SHORT`: fewer hours paid than logged
  2. `OT_AVERAGED_WEEKS` or `OT_STRAIGHT_TIME`: overtime paid at the regular rate
  3. `OT_HOURS_SHORT`: fewer overtime hours paid than worked
  4. `OT_RATE_LOW`: overtime paid below 1.5×
  5. `RATE_MISMATCH`: hourly rate lower than yours
  6. `UNEXPLAINED_SHORTFALL`: none of the above

  `OVERPAID` is reported when gross is higher than expected.
- **Other checks** run independently: Social Security and Medicare amounts, whether net pay adds up, and new or increased pre-tax deductions. The verdict **review** means gross pay matches but one of these checks failed.
- **Repayment.** A later stub repays an open case when its adjustment line, or its gross above that period's expected gross, is within $1.00 of the case amount. That money is left out of the later period's own comparison, so a repayment is never mistaken for an overpayment.

## Where AI is used, and where it isn't

AI is used in two optional places, both through `src/lib/llm.ts` (Anthropic API; the model is set by `LLM_MODEL`, default `claude-opus-5-5`):

1. **Reading a pay stub photo** (`/api/extract-stub`). The model copies the figures into a schema-validated form, and the user reviews the pre-filled form before running the check. Images are processed in memory and never stored.
2. **Rewording a recovery message** (`/api/draft-message`). The server rebuilds the template from the case facts and asks for more natural wording. The rewrite is used only if every dollar amount, date and hour figure from the template is still there unchanged; otherwise the template is used as is.

AI never calculates pay, decides whether there is a discrepancy or picks the cause. Both routes are rate limited per IP and capped in size. Without an API key the app works fully with manual entry and template messages.

## Architecture

```
src/
  app/                       Next.js routes; the UI runs in the browser and state lives in localStorage
    page.tsx                 landing page
    app/                     home, setup, shifts, periods/[id]/check|result, cases/[id](/evidence), checkout
    api/extract-stub/        photo → stub fields (optional, AI)
    api/draft-message/       template → reworded message (optional, AI)
  components/                UI components; they display engine output and contain no pay math
  lib/
    pay/                     the pay engine: pure functions, no I/O
      money.ts               integer-cent math, rounding, parsing without floats
      dates.ts               time-zone-free calendar math and workweeks
      hours.ts               shift length, overnight shifts, splitting at the workweek boundary
      overtime.ts            weekly overtime and expected gross
      taxes.ts               Social Security and Medicare
      audit.ts               audit rules, causes and tolerances
      periods.ts             weekly and biweekly pay periods aligned to workweeks
    case/                    recovery case: ladder, message templates, repayment matching (pure)
    check.ts                 matches repayments first, then runs the audit
    actions.ts               pure state transitions used by the UI
    storage.ts               one versioned localStorage key, validated with Zod
    sample.ts                the sample persona, generated relative to today
    llm.ts                   the only file that talks to an AI provider
```

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zod, Vitest.

**Tests.** 41 tests cover the pay engine and recovery cases: 20 reference pay scenarios (weekly overtime, overnight shifts, week boundaries, rounding, FICA, short hours, straight-time overtime, a low rate, net-pay arithmetic, overpayment) and an end-to-end run of the sample (shortfall → case → demo clock → repayment → recovered).

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest
npm run lint
npm run typecheck
```

AI features are optional. To turn them on, create `.env.local`:

```bash
LLM_API_KEY=your-anthropic-api-key
LLM_MODEL=claude-opus-5-5   # optional
```

## Known limits

We check federal rules for hourly, non-exempt workers. Not handled yet:

- Federal and state income tax withholding (recorded, never judged)
- The Social Security annual wage base and the Additional Medicare Tax for high earners
- State overtime rules (such as California daily overtime), tips, piece rate, shift differentials, multiple jobs
- Salaried and exempt roles; semi-monthly and monthly pay periods
- Data lives in one browser. Use *Download a backup* on the home screen to move it. Changing the pay schedule clears checked paychecks and cases, because their pay periods no longer exist; shifts are kept, and the setup screen warns first.

---

MoneyRecover provides estimates based on the shifts you log and federal overtime rules. It is not legal, tax or payroll advice.
