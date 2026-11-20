import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ORG_ROLES } from "@/lib/domain";
import type { Membership } from "@/lib/org";

type Props = { email: string; fullName: string | null; active: Membership | null };

export function AppHeader({ email, fullName, active }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <MobileNav />
      {active ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{active.name}</span>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {ORG_ROLES[active.role]}
          </Badge>
        </div>
      ) : null}
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu email={email} fullName={fullName} />
    </header>
  );
}
