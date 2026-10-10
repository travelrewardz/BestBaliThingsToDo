import type { Metadata } from "next";
import { supplierDashboardStats } from "@/lib/dashboard";
import { StatCard, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { requireSupplierPanel, supplierStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Overview" };

export default async function SupplierOverviewPage() {
  const { supplier } = await requireSupplierPanel();
  const s = await supplierDashboardStats(supplier.id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {supplier.companyName}
        </h1>
        <Badge tone={supplierStatusTone(supplier.status)}>
          {statusLabel(supplier.status)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Your tours, bookings and earnings.
        {supplier.ratingCount > 0 && (
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
                <span className="text-slate-700">{statusLabel(status)}</span>
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
                {supplier.ratingCount > 0
                  ? `★ ${supplier.ratingAvg.toFixed(1)} (${supplier.ratingCount})`
                  : "No reviews"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
