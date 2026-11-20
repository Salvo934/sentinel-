import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getOrgContext } from "@/lib/org";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Authoritative session check (proxy.ts only redirects optimistically).
  // Pages and Server Actions re-check on their own; the database enforces RLS.
  const ctx = await getOrgContext();

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Vai al contenuto
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader email={ctx.user.email} fullName={ctx.fullName} active={ctx.active} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          {ctx.active ? (
            children
          ) : (
            <p className="text-sm text-muted-foreground">
              Il tuo account non è associato ad alcuna organizzazione. Contatta un amministratore.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
