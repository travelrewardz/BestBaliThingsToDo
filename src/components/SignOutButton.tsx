"use client";

import { useRouter } from "next/navigation";

/** Signs out via the API and returns to the storefront. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          /* network error — fall through and navigate anyway */
        }
        router.push("/");
        router.refresh();
      }}
      className={`rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 ${className}`}
    >
      Sign out
    </button>
  );
}
