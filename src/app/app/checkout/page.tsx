"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BackLink, Button, Card, Loading, PageTitle } from "@/components/ui";
import { buyPlan, startCase } from "@/lib/actions";
import { formatUsd } from "@/lib/pay/money";
import { setState, useAppState, useNow } from "@/lib/store";

type Plan = "case" | "protection";

const PLANS: { id: Plan; name: string; price: string; cadence: string; points: string[] }[] = [
  {
    id: "case",
    name: "Recovery",
    price: "$3.99",
    cadence: "per case",
    points: ["Evidence page you can print or save as PDF", "Four-step message ladder, ready to send", "Tracks the case until the money is back"],
  },
  {
    id: "protection",
    name: "Protection",
    price: "$5.99",
    cadence: "per month",
    points: ["Unlimited recovery cases", "Every new paycheck checked for repayment automatically", "Cancel anytime"],
  },
];

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const router = useRouter();
  const periodId = useSearchParams().get("period");
  const state = useAppState();
  const now = useNow(state);
  const [plan, setPlan] = useState<Plan>("case");
  if (!state) return <Loading />;

  const audit = periodId ? state.audits.find((a) => a.periodId === periodId) : null;

  function unlock() {
    const caseId = crypto.randomUUID();
    setState((s) => {
      const paid = buyPlan(s, plan);
      return periodId && audit?.verdict === "shortfall" ? startCase(paid, periodId, caseId, now) : paid;
    });
    router.push(periodId && audit?.verdict === "shortfall" ? `/app/cases/${caseId}` : "/app");
  }

  return (
    <>
      <BackLink href={audit ? `/app/periods/${periodId}/result` : "/app"} className="mb-4">
        {audit ? "Back to the result" : "Home"}
      </BackLink>
      <PageTitle
        title="Get your money back"
        subtitle={
          audit?.shortfallCents
            ? `Your possible shortfall is ${formatUsd(audit.shortfallCents)}. Logging shifts and checking paychecks stay free.`
            : "Logging shifts and checking paychecks stay free."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Choose a plan">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={plan === p.id}
            onClick={() => setPlan(p.id)}
            className={`flex flex-col items-start justify-start rounded-xl border-2 bg-surface p-5 text-left transition-colors ${plan === p.id ? "border-accent" : "border-line hover:border-muted"}`}
          >
            <div className="font-semibold">{p.name}</div>
            <div className="mt-2">
              <span className="text-3xl font-semibold">{p.price}</span> <span className="text-muted">{p.cadence}</span>
            </div>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted">
              {p.points.map((point) => (
                <li key={point}>✓ {point}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <Card className="mt-6 border-dashed">
        <p className="text-sm font-medium text-warn">Demo checkout — no charge</p>
        <p className="mt-1 text-sm text-muted">
          This hackathon build has no real payments. The button below unlocks the plan you picked so you can try the full recovery flow.
        </p>
        <Button className="mt-4" onClick={unlock} data-guide="unlock">
          Unlock {plan === "case" ? "this case" : "Protection"} (demo)
        </Button>
      </Card>
    </>
  );
}
