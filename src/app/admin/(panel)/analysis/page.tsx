import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatCard, Badge } from "@/components/ui";
import { LineChart, DonutChart } from "@/components/charts";
import { PageHeader } from "@/components/admin/DataTable";
import { analyticsSummary, rangeFor } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Analysis" };

const RANGES = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "3m", label: "3 months" },
  { key: "12m", label: "12 months" },
] as const;

export default async function AdminAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const window = rangeFor(range.key);

  const [summary, trendRaw, topProducts, statusGroups] = await Promise.all([
    analyticsSummary(window),
    prisma.booking.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: window.from, lte: window.to } },
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ bookingCount: "desc" }, { viewCount: "desc" }],
      take: 8,
      select: { id: true, name: true, slug: true, bookingCount: true, viewCount: true, ratingAvg: true, ratingCount: true },
    }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Build a daily trend over the window (capped at 60 points).
  const days: { date: string; count: number }[] = [];
  const cursor = new Date(window.from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(window.to);
  while (cursor <= end && days.length < 60) {
    const key = cursor.toISOString().slice(0, 10);
    const row = trendRaw.find((r) => r.createdAt.toISOString().slice(0, 10) === key);
    days.push({ date: key, count: row?._count._all ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const palette = ["#0f766e", "#f97316", "#0ea5e9", "#22c55e", "#ef4444", "#a855f7", "#64748b"];
  const segments = statusGroups
    .sort((a, b) => b._count._all - a._count._all)
    .map((g, i) => ({ label: statusLabel(g.status), value: g._count._all, color: palette[i % palette.length] }));

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Analysis"
        subtitle={`Traffic, funnel and revenue for the last ${range.label.toLowerCase()}.`}
      />

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/analysis?range=${r.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              r.key === range.key ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Gross booking value" value={formatMoney(summary.grossBookingValueCents)} icon="💰" />
        <StatCard label="Net revenue (commission)" value={formatMoney(summary.netRevenueCents)} icon="🏦" tone="orange" />
        <StatCard label="Supplier payouts" value={formatMoney(summary.supplierPayoutCents)} icon="💸" tone="green" />
        <StatCard label="Bookings" value={summary.bookings} hint={`${summary.paidBookings} paid`} icon="🎟️" />
        <StatCard label="Average booking" value={formatMoney(summary.avgBookingCents)} icon="📊" tone="blue" />
        <StatCard label="Conversion" value={`${summary.conversionRate}%`} hint={`${summary.checkouts} checkouts · ${summary.productViews} views`} icon="🎯" tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Bookings trend</h2>
          <div className="mt-3">
            <LineChart data={days} label="bookings" />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Booking status mix</h2>
          <div className="mt-4">
            {segments.length ? <DonutChart segments={segments} /> : <p className="text-sm text-slate-400">No bookings yet.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Top tours</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {topProducts.length === 0 && <li className="py-3 text-slate-400">No published tours yet.</li>}
          {topProducts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{p.name}</span>
                <span className="block text-xs text-slate-400">
                  {p.viewCount} views · {p.ratingCount > 0 ? `★ ${p.ratingAvg.toFixed(1)} (${p.ratingCount})` : "no reviews"}
                </span>
              </span>
              <Badge tone="brand">{p.bookingCount} bookings</Badge>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
