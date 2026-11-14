import { Card, LinkButton } from "./ui";
import { SampleButton } from "./sample-button";

export function NeedsSetup() {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <h1 className="text-xl font-semibold">Let&apos;s set up your pay first</h1>
      <p className="mt-2 text-muted">
        We need your hourly rate and pay schedule to know what your paycheck should be. Or try the app with a sample worker.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <LinkButton href="/app/setup">Set up my pay</LinkButton>
        <SampleButton variant="secondary" />
      </div>
    </Card>
  );
}
