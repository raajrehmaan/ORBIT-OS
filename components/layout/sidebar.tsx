"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Scissors, Settings, Users, UserRoundCog } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Create Appointment", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/staff", label: "Staff", icon: UserRoundCog },
  { href: "/services", label: "Services", icon: Scissors },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function TopNavigation() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-surface/95 px-4 py-3 backdrop-blur md:px-8">
      <nav className="flex gap-2 overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition hover:bg-muted hover:text-foreground",
              isActiveRoute(pathname, item.href) ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-4 w-4", isActiveRoute(pathname, item.href) ? "text-primary" : "text-muted-foreground")} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
