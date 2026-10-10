"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";

/** Left navigation rail for the admin panel. */
export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Admin sections"
      className="mb-4 lg:mb-0 lg:w-60 lg:shrink-0"
    >
      <ul className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:flex-col lg:overflow-visible">
        {ADMIN_SECTIONS.map((s) => {
          const active = isActive(s.href);
          return (
            <li key={s.href} className="shrink-0 lg:shrink">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden>{s.icon}</span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
