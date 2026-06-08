import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/auth/permissions";
import type { Role } from "@/types/database";
import { signOut } from "@/lib/actions/auth";

export function Topbar({ name, role }: { name: string; role: Role }) {
  return (
    <header className="flex min-h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-8">
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{roleLabels[role]}</p>
      </div>
      <form action={signOut}>
        <Button variant="outline" size="icon" title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </header>
  );
}
