"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

const links = [
  { href: "/app", label: "Home" },
  { href: "/app/shifts", label: "Shifts" },
  { href: "/app/setup", label: "Pay setup" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="MoneyRecover home">
          <Logo />
        </Link>
        <nav className="flex gap-1 text-sm">
          {links.map((link) => {
            const active = link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 sm:px-3 ${active ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:text-ink"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
