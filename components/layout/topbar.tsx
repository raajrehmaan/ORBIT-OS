import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/auth/permissions";
import type { Role } from "@/types/database";
import { signOut } from "@/lib/actions/auth";

export function Topbar({ name, role, organisationName, logoUrl }: { name: string; role: Role; organisationName?: string | null; logoUrl?: string | null }) {
  const initials = (organisationName ?? "OrbitOS").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="flex min-h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={organisationName ?? "Organisation logo"} className="h-10 w-10 rounded-md object-cover" />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">{initials}</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{organisationName ?? name}</p>
          <p className="truncate text-xs text-muted-foreground">{name} · {roleLabels[role]}</p>
        </div>
      </div>
      <form action={signOut}>
        <Button variant="outline" size="icon" title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </header>
  );
}
