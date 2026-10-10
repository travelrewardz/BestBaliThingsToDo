import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { rangeFor } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { statusLabel } from "@/lib/supplier";
import { fmtDate } from "@/lib/admin";

export const metadata: Metadata = { title: "Reports" };

const PAID = ["PAID", "CONFIRMED", "COMPLETED"] as const;
const RANGES = [
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
] as const;

type MonthRow = { month: string; bookings: number; grossCents: number; commissionCents: number; supplierCents: number };
type SupplierRow = { supplierId: string; name: string; bookings: number; grossCents: number; commissionCents: number };
type PayoutRow = Awaited<ReturnType<typeof loadPayouts>>[number];

async function loadPayouts() {
  return prisma.payout.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 25,
    select: {
      id: true,
      amountCents: true,
      currency: true,
      status: true,
      reference: true,
      createdAt: true,
      paidAt: true,
      supplier: { select: { companyName: true } },
    },
  });
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const window = rangeFor(range.key);

  const [bookings, supplierGroups, payouts] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { in: [...PAID] }, createdAt: { gte: window.from, lte: window.to } },
      select: { createdAt: true, totalCents: true, commissionCents: true, supplierEarningsCents: true, supplierId: true },
    }),
    prisma.booking.groupBy({
      by: ["supplierId"],
      where: { status: { in: [...PAID] }, createdAt: { gte: window.from, lte: window.to } },
      _sum: { totalCents: true, commissionCents: true },
      _count: { _all: true },
    }),
    loadPayouts(),
  ]);

  // Aggregate by month.
  const byMonth = new Map<string, MonthRow>();
  for (const b of bookings) {
    const key = b.createdAt.toISOString().slice(0, 7);
    const row = byMonth.get(key) ?? { month: key, bookings: 0, grossCents: 0, commissionCents: 0, supplierCents: 0 };
    row.bookings += 1;
    row.grossCents += b.totalCents;
    row.commissionCents += b.commissionCents;
    row.supplierCents += b.supplierEarningsCents;
    byMonth.set(key, row);
  }
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));

  const supplierNames = await prisma.supplier.findMany({
    where: { id: { in: supplierGroups.map((g) => g.supplierId) } },
    select: { id: true, companyName: true },
  });
  const nameById = new Map(supplierNames.map((s) => [s.id, s.companyName]));
  const suppliers: SupplierRow[] = supplierGroups
    .map((g) => ({
      supplierId: g.supplierId,
      name: nameById.get(g.supplierId) ?? "—",
      bookings: g._count._all,
      grossCents: g._sum.totalCents ?? 0,
      commissionCents: g._sum.commissionCents ?? 0,
    }))
    .sort((a, b) => b.grossCents - a.grossCents)
    .slice(0, 12);

  const totals = months.reduce(
    (acc, m) => ({
      bookings: acc.bookings + m.bookings,
      grossCents: acc.grossCents + m.grossCents,
      commissionCents: acc.commissionCents + m.commissionCents,
      supplierCents: acc.supplierCents + m.supplierCents,
    }),
    { bookings: 0, grossCents: 0, commissionCents: 0, supplierCents: 0 }
  );

  const monthCols: Column<MonthRow>[] = [
    { key: "month", header: "Month", render: (m) => <span className="font-semibold text-slate-900">{m.month}</span> },
    { key: "bookings", header: "Bookings", render: (m) => <span className="text-slate-600">{m.bookings}</span> },
    { key: "gross", header: "Gross", render: (m) => <span className="font-semibold text-slate-900">{formatMoney(m.grossCents)}</span> },
    { key: "commission", header: "Commission", render: (m) => <span className="text-slate-700">{formatMoney(m.commissionCents)}</span> },
    { key: "supplier", header: "Supplier payouts", render: (m) => <span className="text-slate-700">{formatMoney(m.supplierCents)}</span> },
  ];

  const supplierCols: Column<SupplierRow>[] = [
    { key: "name", header: "Supplier", render: (s) => <span className="font-semibold text-slate-900">{s.name}</span> },
    { key: "bookings", header: "Bookings", render: (s) => <span className="text-slate-600">{s.bookings}</span> },
    { key: "gross", header: "Gross", render: (s) => <span className="font-semibold text-slate-900">{formatMoney(s.grossCents)}</span> },
    { key: "commission", header: "Platform commission", render: (s) => <span className="text-slate-700">{formatMoney(s.commissionCents)}</span> },
  ];

  const payoutCols: Column<PayoutRow>[] = [
    { key: "supplier", header: "Supplier", render: (p) => <span className="font-semibold text-slate-900">{p.supplier.companyName}</span> },
    { key: "amount", header: "Amount", render: (p) => <span className="font-semibold text-slate-900">{formatMoney(p.amountCents, p.currency)}</span> },
    { key: "status", header: "Status", render: (p) => <Badge tone={p.status === "PAID" ? "green" : p.status === "REJECTED" ? "red" : "amber"}>{statusLabel(p.status)}</Badge> },
    { key: "created", header: "Created", render: (p) => <span className="text-slate-500">{fmtDate(p.createdAt)}</span> },
    { key: "paid", header: "Paid", render: (p) => <span className="text-slate-500">{p.paidAt ? fmtDate(p.paidAt) : "—"}</span> },
    { key: "ref", header: "Reference", render: (p) => <span className="font-mono text-xs text-slate-500">{p.reference || "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Reports"
        subtitle="Revenue, commission and payout reporting."
      />

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/reports?range=${r.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              r.key === range.key ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Totals for the period</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-4 text-sm">
          <div><dt className="text-slate-500">Paid bookings</dt><dd className="mt-0.5 text-xl font-bold text-slate-900">{totals.bookings}</dd></div>
          <div><dt className="text-slate-500">Gross booking value</dt><dd className="mt-0.5 text-xl font-bold text-slate-900">{formatMoney(totals.grossCents)}</dd></div>
          <div><dt className="text-slate-500">Platform commission</dt><dd className="mt-0.5 text-xl font-bold text-slate-900">{formatMoney(totals.commissionCents)}</dd></div>
          <div><dt className="text-slate-500">Supplier payouts</dt><dd className="mt-0.5 text-xl font-bold text-slate-900">{formatMoney(totals.supplierCents)}</dd></div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">By month</h2>
        <DataTable columns={monthCols} rows={months} rowKey={(m) => m.month} emptyTitle="No paid bookings in this period" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Top suppliers</h2>
        <DataTable columns={supplierCols} rows={suppliers} rowKey={(s) => s.supplierId} emptyTitle="No supplier revenue in this period" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Recent payouts</h2>
        <DataTable columns={payoutCols} rows={payouts} rowKey={(p) => p.id} emptyTitle="No payouts yet" />
      </section>
    </>
  );
}
