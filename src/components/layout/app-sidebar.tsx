import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60">
          <Logo inverted />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <SidebarNav />
      </div>
      <p className="border-t border-sidebar-border px-5 py-3 text-[11px] leading-relaxed text-sidebar-foreground/50">
        Strumento di analisi e formazione. Le valutazioni restano responsabilità dell&apos;analista.
      </p>
    </aside>
  );
}
