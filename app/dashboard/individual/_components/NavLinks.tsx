"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard/individual", label: "Dashboard" },
  { href: "/dashboard/individual/lists", label: "Lists" },
  { href: "/dashboard/individual/campaigns", label: "Campaigns" },
  { href: "/dashboard/individual/billing", label: "Billing" },
  { href: "/dashboard/individual/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden sm:flex items-center gap-1">
      {links.map((item) => {
        const isActive = item.href === "/dashboard/individual"
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            // FIX — disable automatic prefetch to avoid opening many parallel DB-backed route requests
            prefetch={false}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              isActive
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
