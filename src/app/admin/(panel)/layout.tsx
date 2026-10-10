import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";
import { SignOutButton } from "@/components/SignOutButton";
import { AdminSidebar } from "@/components/AdminSidebar";

export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Admin" },
  robots: { index: false },
};

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <Link href="/admin" className="font-display text-lg font-bold text-brand-900">
            🌴 Bali Things To Do
          </Link>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-700">
            Admin
          </span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" className="hidden text-slate-500 hover:text-slate-800 sm:inline">
              View site ↗
            </Link>
            <span className="hidden text-slate-500 sm:inline">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 lg:flex lg:gap-6">
        <AdminSidebar />
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
