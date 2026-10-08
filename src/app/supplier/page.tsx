import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { supplierDashboardStats } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Supplier dashboard",
  robots: { index: false },
};

export default async function SupplierDashboardPage() {
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

  const [s, supplier] = await Promise.all([
    supplierDashboardStats(user.supplierId),
    prisma.supplier.findUnique({
      where: { id: user.supplierId },
      select: { companyName: true, status: true, ratingAvg: true, ratingCount: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-display text-lg font-bold text-brand-900">
            🌴 Bali Things To Do
          </Link>
          <span className="rounded-full bg-sunset-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-sunset-700">
            Supplier
          </span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {supplier?.companyName ?? user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {supplier?.companyName ?? "Your dashboard"}
          </h1>
          {supplier && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                supplier.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {supplier.status}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Your tours, bookings and earnings.
          {supplier && supplier.ratingCount > 0 && (
            <> ★ {supplier.ratingAvg.toFixed(1)} from {supplier.ratingCount} reviews</>
          )}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Net earnings"
            value={formatMoney(s.netEarningsCents)}
            hint={`${s.totalBookings} paid bookings`}
            icon="💰"
          />
          <StatCard
            label="Earnings this month"
            value={formatMoney(s.monthEarningsCents)}
            hint={`${formatMoney(s.monthSalesCents)} in sales`}
            icon="🗓️"
            tone="green"
          />
          <StatCard
            label="Upcoming tours"
            value={s.upcomingBookings}
            icon="🚌"
            tone="blue"
          />
          <StatCard
            label="Pending payout"
            value={formatMoney(s.pendingPayoutCents)}
            hint={`${formatMoney(s.paidPayoutCents)} already paid out`}
            icon="💸"
            tone="orange"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Your listings
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {Object.entries(s.productCounts).length === 0 && (
                <li className="text-slate-400">No listings yet.</li>
              )}
              {Object.entries(s.productCounts).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between">
                  <span className="text-slate-700">{status}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Performance
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Total sales</dt>
                <dd className="font-bold text-slate-900">
                  {formatMoney(s.totalSalesCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Unsettled commissions</dt>
                <dd className="font-bold text-slate-900">{s.unsettledCommissions}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Average rating</dt>
                <dd className="font-bold text-slate-900">
                  {s.ratingCount > 0
                    ? `★ ${s.ratingAvg.toFixed(1)} (${s.ratingCount})`
                    : "No reviews"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
