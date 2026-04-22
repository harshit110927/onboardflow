"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { KanbanSquare } from "lucide-react";

const links = [
  { href: "/dashboard/individual", label: "Dashboard" },
  { href: "/dashboard/individual/lists", label: "Lists" },
  { href: "/dashboard/individual/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/dashboard/individual/campaigns", label: "Campaigns" },
  { href: "/dashboard/individual/billing", label: "Billing" },
  { href: "/dashboard/individual/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of links) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <nav className="hidden sm:flex items-center gap-1">
      {links.map((item) => {
        const isActive = item.href === "/dashboard/individual"
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={`nav-link text-sm px-3 py-1.5 rounded-md transition-colors ${
              isActive
                ? "active"
                : "hover:text-white hover:bg-white/10"
            }`}
          >
            {Icon ? <Icon size={18} className="inline mr-1.5 align-text-bottom" /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
