import Link from "next/link";
import { Logo } from "@/components/logo";
import { SampleButton } from "@/components/sample-button";
import { Disclaimer, LinkButton } from "@/components/ui";

const PAYCHEX_URL = "https://www.paychex.com/articles/payroll-taxes/catching-payroll-errors";

const steps = [
  {
    title: "Log your shifts",
    body: "Start, end and break. We count overtime the federal way: over 40 hours in each workweek, never averaged.",
  },
  {
    title: "Check each paycheck",
    body: "Type in the numbers from your stub, or snap a photo. You get a line-by-line comparison and a likely cause in plain English.",
  },
  {
    title: "Get the money back",
    body: "A Recovery Case gives you an evidence page and a calm message for every step, from a friendly check to outside help, until the money shows up.",
  },
];

const checks = [
  "Regular and overtime hours, per workweek",
  "Overtime paid at 1.5× your rate",
  "Your hourly rate",
  "Social Security and Medicare (6.2% and 1.45%)",
  "Whether net pay adds up",
  "New or larger pre-tax deductions",
  "Repayment on later paychecks",
];

const notYet = [
  "Federal and state income tax withholding",
  "State-specific overtime (like California daily overtime)",
  "Tips, piece rate, shift differentials, multiple jobs",
  "Salaried roles; semi-monthly or monthly pay",
];

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/app" className="text-sm font-medium text-muted hover:text-accent">
          Open the app
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <section className="py-12 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Is your paycheck right? Find out - and get back what&apos;s missing.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            For hourly workers whose schedule changes every week. 43% of US employees had a paycheck error in the past year, and most caught it
            themselves.{" "}
            <a href={PAYCHEX_URL} className="text-sm underline underline-offset-2 hover:text-accent" target="_blank" rel="noreferrer">
              Source: Paychex, 2026
            </a>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SampleButton />
            <LinkButton href="/app/setup" variant="secondary" className="px-5 py-3 text-base">
              Start with my own shifts
            </LinkButton>
          </div>
          <p className="mt-3 text-sm text-muted">No sign-up. Your data stays in this browser.</p>
        </section>

        <section className="border-t border-line py-12">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-8 border-t border-line py-12 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">What we check</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {checks.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-accent" aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">What we don&apos;t check yet</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {notYet.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">–</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-line py-12">
          <h2 className="font-semibold">Free to check. Pay only to recover.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Logging shifts and checking paychecks are free. When a paycheck comes up short, a Recovery Case is $3.99, or $5.99 a month for unlimited
            cases with every new paycheck watched for repayment.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Disclaimer />
        </div>
      </footer>
    </>
  );
}
