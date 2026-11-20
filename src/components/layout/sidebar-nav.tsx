"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const base =
    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/60";

  return (
    <nav aria-label="Navigazione principale" className="flex flex-col gap-5">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.label ?? `s${index}`} className="flex flex-col gap-0.5">
          {section.label ? (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
              {section.label}
            </p>
          ) : null}
          {section.items.map(({ href, label, icon: Icon, planned }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : planned
                      ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/50"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-sidebar-primary")} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {planned ? (
                  <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                    {planned}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
