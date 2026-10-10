"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/supplier", label: "Overview" },
  { href: "/supplier/tours", label: "Tours" },
  { href: "/supplier/bookings", label: "Bookings" },
  { href: "/supplier/profile", label: "Profile" },
];

/** Section tabs for the supplier panel. Active state from the current path. */
export function SupplierTabs() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/supplier" ? pathname === "/supplier" : pathname.startsWith(href);

  return (
    <nav className="border-t border-brand-800" aria-label="Supplier sections">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-b-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-slate-50 text-brand-800"
                  : "text-brand-100/80 hover:bg-brand-800/60 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
