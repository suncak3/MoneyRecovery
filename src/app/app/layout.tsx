import { AppHeader } from "@/components/app-header";
import { Onboarding } from "@/components/onboarding";
import { Disclaimer } from "@/components/ui";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <AppHeader />
      <Onboarding />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
      <footer className="no-print border-t border-line">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Disclaimer />
        </div>
      </footer>
    </>
  );
}
