"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";

type UserMenuProps = { email: string; fullName: string | null };

export function initialsOf(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({ email, fullName }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Menu utente">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initialsOf(fullName, email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium md:inline">{fullName ?? email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">{fullName ?? "Utente"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound /> Profilo e impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Esci
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
