"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Apri menu di navigazione">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="h-16 justify-center px-5">
          <SheetTitle className="text-sidebar-foreground">
            <Logo inverted />
          </SheetTitle>
          <SheetDescription className="sr-only">Navigazione principale</SheetDescription>
        </SheetHeader>
        <div className="px-3 py-2">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
