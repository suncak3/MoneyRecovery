# MoneyRecover

**Log your shifts, know what your paycheck should be, and when it comes up short, get the money back step by step.**

**Live: [moneyrecovery.vercel.app](https://moneyrecovery.vercel.app/)**. Web only, no sign-up, data stays in your browser. Built for the Zimran Business Cup (24h).

## Try it in two minutes

Open the app and press **Try with a sample**. A guided tour walks through the whole loop with Maria, a warehouse associate paid $22.00/h every two weeks:

1. Maria worked 45 hours one week and 35 the next, so her shifts say **$1,815.00** gross.
2. **Check the paycheck**: her stub pays 80 hours at the regular rate. The check finds **$55.00 missing**: payroll averaged the two weeks, so 5 overtime hours were paid at $22.00 instead of $33.00.
3. **Start a Recovery Case** (demo checkout, nothing is charged) and send the friendly first message to payroll.
4. **Skip 7 days** with the demo clock. The follow-up message becomes current.
5. **Check her next paycheck**: it carries $55.00 of retro pay, and the case closes itself as **recovered**.

Every number on the way comes from the deterministic pay engine in `src/lib/pay`, not from an LLM.

## The user and the pain

A US hourly worker, 25–45, with a schedule that changes every week (warehouse, retail, restaurant, delivery), paid weekly or biweekly.

- Hours change every week, so they can't tell whether a paycheck is right.
- Payroll mistakes are common: 43% of US employees had a paycheck error in the past year, and 57% of them caught the latest one themselves ([Paychex Employee Compensation Confidence Index, 2026](https://www.paychex.com/articles/payroll-taxes/catching-payroll-errors)).
- Raising it with payroll without numbers is uncomfortable, so small shortfalls are never recovered.

Shift trackers and paycheck checkers exist. They stop at "you were shorted $55". MoneyRecover is built around what happens next: a **Recovery Case** that walks the worker from evidence to confirmed repayment. Tracking is the input; recovery is the product.

## What it does

1. **Shift log** with live expected gross pay, overtime counted per workweek, and a chart that shows each week against the 40-hour line.
2. **Paycheck check**: type in the stub figures (or upload a photo to pre-fill them) and get a line-by-line comparison, a probable cause in plain English and the numbers behind it. A live comparison updates as you type.
3. **Recovery Case** (paid): a printable evidence page, a four-step message ladder (friendly check → follow-up → formal written request → US Department of Labor complaint guide), outcome tracking, calendar reminders (.ics) for the next step, and automatic verification: when a later paycheck includes the missing amount, the case closes as **recovered**.
4. **Home** leads with *Recovered so far*, *Open cases* and *Paychecks verified*.

Checking is free. Recovery is **$3.99 per case** or **$5.99/month** for unlimited cases. Checkout is a clearly labelled demo that never blocks the flow.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine and case tests (Vitest)
npm run lint
npm run typecheck
```

Node 20.9+ is required. AI features are optional; create `.env.local` with `LLM_API_KEY=<an Anthropic key>` (and optionally `LLM_MODEL`) to enable them. Without a key, manual entry and the template messages work as usual.

## Architecture

```
src/
  app/                       routes (all UI is client-side; state lives in localStorage)
    page.tsx                 landing
    app/                     home, setup, shifts, periods/[id]/check|result, cases/[id](/evidence), checkout
    api/extract-stub         photo → stub fields (optional, LLM)
    api/draft-message        template → reworded message (optional, LLM)
  lib/
    pay/                     the pay engine: pure functions, no I/O
      money.ts               integer-cent math, round half up, parsing without floats
      dates.ts               time-zone-free day numbers, workweeks
      hours.ts               shift duration, overnight shifts, splitting at the workweek boundary
      overtime.ts            weekly overtime and expected gross
      taxes.ts               Social Security and Medicare
      audit.ts               the audit rules and tolerances
      periods.ts             weekly / biweekly pay periods aligned to workweeks
    case/                    recovery case: ladder, templates, repayment verification (pure)
    check.ts                 verification first, then audit, so repayments are never read as overpayments
    actions.ts               pure state transitions used by the UI
    storage.ts               one versioned localStorage key, validated with Zod
    sample.ts                sample persona generated relative to today
    llm.ts                   the only file that talks to an LLM provider
```

UI components render engine output and contain no pay math. `lib/pay` and `lib/case` are covered by tests, including the 20 cases from the spec and an end-to-end test of the sample persona (open case → demo clock → repayment → recovered).

## The rules the engine applies

All time is integer minutes and all money is integer cents. Each line is rounded half up once.

| Rule | Implementation | Source |
|---|---|---|
| Overtime is hours over 40 in a workweek, at 1.5× the regular rate | `overtime.ts` | [FLSA overtime, DOL Fact Sheet #23](https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay) |
| Each workweek stands alone; hours are never averaged across weeks | `weeklyTotals` | [29 CFR 778.104](https://www.ecfr.gov/current/title-29/section-778.104) |
| A workweek is a fixed, recurring 168-hour period; a shift crossing the boundary is split | `splitByWorkweek` | [29 CFR 778.105](https://www.ecfr.gov/current/title-29/section-778.105) |
| Social Security 6.2%, Medicare 1.45% of FICA wages | `taxes.ts` | [IRS Publication 15](https://www.irs.gov/publications/p15) |
| Section 125 premiums (health, dental, vision) reduce FICA wages; 401(k) deferrals don't | `ficaWages` | IRS Publication 15-B |

Regular pay = `round(regMinutes × rate / 60)`, overtime pay = `round(otMinutes × rate × 3 / 120)`. FICA is checked against the stub's own gross (internal consistency). When a shift crosses a workweek boundary, its unpaid break is shared in proportion to the time on each side.

**Audit tolerances**: gross $1.00, taxes $0.05, hours 6 minutes, rate $0.01.

**Gross causes**, tried in this order, first match wins: `HOURS_SHORT` → `OT_AVERAGED_WEEKS` / `OT_STRAIGHT_TIME` → `OT_HOURS_SHORT` → `OT_RATE_LOW` → `RATE_MISMATCH` → `UNEXPLAINED_SHORTFALL`; `OVERPAID` when gross is higher than expected. Independent checks: `FICA_SS_MISMATCH`, `FICA_MEDICARE_MISMATCH`, `NET_ARITHMETIC`, `DEDUCTION_NEW`, `DEDUCTION_INCREASED`. Verdict `review` means gross matches but a tax or net-pay check failed.

**Repayment**: a later stub repays an open case when its adjustment line, or its gross above that period's expected gross, is within $1.00 of the case amount. That money is excluded from the later period's own comparison.

## Decisions the spec left open

- The sample shows two finished pay periods: the short one, and the next one, which carries the $55.00 as retro pay, so the whole recovery loop can be tried immediately.
- "They disagree" moves the case straight to the formal written request, since a friendly follow-up adds little after a "no".
- The paywall stores a plan (`protection`) or per-case credits instead of a single `unlocked` flag, so $3.99-per-case is modelled honestly.
- Changing the pay schedule clears checked paychecks and cases (their period ids no longer exist); shifts are kept. The setup screen warns first.

## Where AI is used, and where it isn't

Used in exactly two optional places, through `src/lib/llm.ts` (Anthropic API, model from `LLM_MODEL`, default `claude-opus-5-5`):

1. **Reading a pay stub photo** (`/api/extract-stub`): returns schema-validated fields. The user reviews the pre-filled form before running the check. Images are processed in memory and never stored.
2. **Rewording a recovery message** (`/api/draft-message`): the server rebuilds the template from the case facts, asks for a more natural wording, and uses it only if every dollar amount, date and hour figure from the template appears unchanged. Otherwise the template is returned.

AI never computes pay, decides whether there is a discrepancy, or chooses the cause. Both routes are rate limited per IP (in memory, so per server instance) and size capped. Requests use the API's server-side fallback (`fallbacks: "default"`), so a declined request is retried on another model instead of failing.

## Known limits

We check federal rules for hourly, non-exempt workers only. Not handled yet:

- Federal and state income tax withholding (recorded, never judged)
- The Social Security annual wage base and the Additional Medicare Tax for high earners
- State overtime rules (e.g. California daily overtime), tips, piece rate, shift differentials, multiple jobs
- Salaried / exempt roles, semi-monthly and monthly pay periods
- Data lives in one browser; use *Download a backup* on the home screen to move it

MoneyRecover provides estimates based on the shifts you log and federal overtime rules. It is not legal, tax or payroll advice.
