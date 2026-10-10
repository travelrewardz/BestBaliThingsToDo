import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";
import { SupplierTabs } from "@/components/SupplierTabs";

export const metadata: Metadata = {
  title: { template: "%s · Supplier", default: "Supplier" },
  robots: { index: false },
};

export default async function SupplierPanelLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/supplier/login");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role !== "SUPPLIER") redirect("/");

  if (!user.supplierId) {
    // Role is SUPPLIER but no Supplier profile — application not finished.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-4 text-center text-white">
        <h1 className="font-display text-2xl font-bold">Application in progress</h1>
        <p className="mt-2 max-w-md text-brand-200">
          We couldn&apos;t find a supplier profile for this account. Please contact
          support or submit a new supplier application.
        </p>
        <Link
          href="/supplier/register"
          className="mt-6 rounded-xl bg-sunset-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-sunset-600"
        >
          Apply as a supplier
        </Link>
      </div>
    );
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: user.supplierId },
    select: { companyName: true, status: true },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-900">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/supplier" className="font-display text-lg font-bold text-white">
            🌴 Bali Things To Do
          </Link>
          <span className="rounded-full bg-sunset-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Supplier
          </span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-brand-100 sm:inline">
              {supplier?.companyName ?? user.name}
            </span>
            <SignOutButton className="border-brand-700 text-brand-100 hover:border-brand-500 hover:text-white" />
          </div>
        </div>
        <SupplierTabs />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
