"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function HeaderInteractions() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:border-brand-300 lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <form onSubmit={submit} className="mb-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Bali activities…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </form>
          <nav className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            {[
              ["/search", "All tours"],
              ["/activity/atv", "ATV"],
              ["/destination/nusa-penida", "Nusa Penida"],
              ["/blog", "Blog"],
              ["/login", "Sign in"],
              ["/register", "Create account"],
              ["/account", "My account"],
            ].map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-brand-50 hover:text-brand-700">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
