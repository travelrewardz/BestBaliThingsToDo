import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { adminDashboardStats } from "@/lib/dashboard";
import { StatCard } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { SignOutButton } from "@/components/SignOutButton";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false },
};

export default async function AdminDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "SUPPLIER") redirect("/supplier");
  if (user.role !== "ADMIN") redirect("/");

  const s = await adminDashboardStats();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-display text-lg font-bold text-brand-900">
            🌴 Bali Things To Do
          </Link>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-700">
            Admin
          </span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Dashboard overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Marketplace performance at a glance.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross revenue"
            value={formatMoney(s.grossRevenueCents)}
            hint={`${s.totalBookings} paid bookings`}
            icon="💰"
          />
          <StatCard
            label="Platform commission"
            value={formatMoney(s.platformCommissionCents)}
            hint={`${Math.round(
              s.grossRevenueCents > 0
                ? (s.platformCommissionCents / s.grossRevenueCents) * 100
                : 0
            )}% take rate`}
            icon="🏦"
            tone="orange"
          />
          <StatCard
            label="Bookings today"
            value={s.todayBookings}
            hint={`${s.upcomingBookings} upcoming tours`}
            icon="🗓️"
            tone="green"
          />
          <StatCard
            label="Customers"
            value={s.totalCustomers}
            hint={`+${s.newCustomers7d} in the last 7 days`}
            icon="👥"
            tone="blue"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active tours" value={s.activeTours} hint={`${s.pendingTours} awaiting review`} icon="🏝️" />
          <StatCard label="Suppliers" value={s.totalSuppliers} hint={`${s.pendingSuppliers} pending approval`} icon="🧑‍🌾" tone="green" />
          <StatCard label="Pending payouts" value={formatMoney(s.pendingPayoutCents)} icon="💸" tone="orange" />
          <StatCard label="Cancelled / refunds" value={s.cancelledCount} hint={`${s.refundRequested} refund requests`} icon="↩️" tone="red" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Bookings — last 30 days
            </h2>
            <div className="mt-3">
              <LineChart data={s.trend} label="bookings" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Top tours
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {s.topTours.length === 0 && (
                <li className="text-slate-400">No bookings yet.</li>
              )}
              {s.topTours.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <span className="line-clamp-1 text-slate-700">{t.name}</span>
                  <span className="shrink-0 font-bold text-slate-900">{t.bookings}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Top suppliers by revenue
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {s.topSuppliers.length === 0 && (
                <li className="text-slate-400">No revenue yet.</li>
              )}
              {s.topSuppliers.map((sup) => (
                <li key={sup.id} className="flex items-center justify-between gap-3">
                  <span className="line-clamp-1 text-slate-700">{sup.name}</span>
                  <span className="shrink-0 font-bold text-slate-900">
                    {formatMoney(sup.revenueCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              This month
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Revenue</dt>
                <dd className="font-bold text-slate-900">
                  {formatMoney(s.monthRevenueCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Commission</dt>
                <dd className="font-bold text-slate-900">
                  {formatMoney(s.monthCommissionCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Supplier earnings</dt>
                <dd className="font-bold text-slate-900">
                  {formatMoney(s.supplierEarningsCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Average booking</dt>
                <dd className="font-bold text-slate-900">
                  {formatMoney(s.avgBookingCents)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
