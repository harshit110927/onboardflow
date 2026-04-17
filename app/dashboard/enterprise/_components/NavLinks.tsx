"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const links = [
  { href: "/dashboard/enterprise", label: "Dashboard" },
  { href: "/dashboard/enterprise/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

export function EnterpriseNavLinks() {
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
        const isActive = item.href === "/dashboard/enterprise"
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={`nav-link text-sm px-3 py-1.5 rounded-md transition-colors ${
              isActive ? "active" : "hover:text-white hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
