"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sampleGuide } from "@/lib/guide";
import { sectionOf, TIPS } from "@/lib/tips";
import { setState, useAppState, useNow } from "@/lib/store";
import { Button } from "./ui";

/** Sample tour banner and first-visit screen intros. Mounted once in the app layout. */
export function Onboarding() {
  const pathname = usePathname();
  const state = useAppState();
  const now = useNow(state);
  const [helpOpen, setHelpOpen] = useState(false);
  if (!state) return null;

  const section = sectionOf(pathname);
  const firstVisit = section !== null && !state.seenTips.includes(section);
  const showTip = section !== null && (firstVisit || helpOpen);
  const guide = sampleGuide(state, pathname, now);

  function closeTip() {
    setHelpOpen(false);
    if (section && firstVisit) setState((s) => ({ ...s, seenTips: [...s.seenTips, section] }));
  }

  return (
    <>
      {guide && (
        <div className="no-print sticky top-0 z-30 border-b border-accent/30 bg-accent-soft">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
              {guide.finished ? "Tour complete" : `Step ${guide.index} of ${guide.total}`}
            </span>
            <p className="min-w-0 flex-1 text-accent-strong">{guide.text}</p>
            <div className="flex items-center gap-3">
              {guide.href && (
                <Link href={guide.href} className="font-semibold text-accent-strong underline underline-offset-2">
                  Take me there →
                </Link>
              )}
              {guide.target && <ShowMe target={guide.target} />}
              <button
                type="button"
                className="text-muted hover:text-ink"
                onClick={() => setState((s) => ({ ...s, guideDismissed: true }))}
              >
                {guide.finished ? "Close" : "Hide tour"}
              </button>
            </div>
          </div>
          {guide.target && <Highlight target={guide.target} />}
        </div>
      )}

      {section && !showTip && (
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="What is this screen?"
          className="no-print fixed right-4 bottom-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg font-semibold text-white shadow-lg hover:bg-accent"
        >
          ?
        </button>
      )}

      {showTip && section && <TipDialog key={section} section={section} onClose={closeTip} />}
    </>
  );
}

function TipDialog({ section, onClose }: { section: keyof typeof TIPS; onClose: () => void }) {
  const tip = TIPS[section];
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    button.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tip-title"
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">New here</p>
        <h2 id="tip-title" className="mt-1 text-xl font-semibold">
          {tip.title}
        </h2>
        <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
          {tip.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>
        <Button ref={button} className="mt-6 w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}

const findTarget = (target: string) => document.querySelector<HTMLElement>(`[data-guide="${target}"]`);

/** Pulses the control the tour points at. Watches the DOM because pages render after state loads. */
function Highlight({ target }: { target: string }) {
  useEffect(() => {
    let current: HTMLElement | null = null;
    const mark = () => {
      const element = findTarget(target);
      if (element === current) return;
      current?.removeAttribute("data-guide-active");
      element?.setAttribute("data-guide-active", "");
      current = element;
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      current?.removeAttribute("data-guide-active");
    };
  }, [target]);
  return null;
}

function ShowMe({ target }: { target: string }) {
  return (
    <button
      type="button"
      className="font-semibold text-accent-strong underline underline-offset-2"
      onClick={() => findTarget(target)?.scrollIntoView({ behavior: "smooth", block: "center" })}
    >
      Show me
    </button>
  );
}
