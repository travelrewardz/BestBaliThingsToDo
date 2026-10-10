import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StatCard, Badge } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { fmtDate } from "@/lib/admin";

export const metadata: Metadata = { title: "Availability" };

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

type DayRow = Awaited<ReturnType<typeof load>>["days"][number];
type OverrideRow = Awaited<ReturnType<typeof load>>["overrides"][number];

async function load() {
  const today = startOfToday();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 60);

  const [days, overrides, agenda, ruleCount, publishedTours] = await Promise.all([
    prisma.availabilityDay.findMany({
      where: { date: { gte: today } },
      orderBy: [{ date: "asc" }],
      take: 60,
      select: {
        id: true,
        date: true,
        capacity: true,
        booked: true,
        product: { select: { name: true, slug: true } },
      },
    }),
    prisma.availabilityOverride.findMany({
      where: { date: { gte: today, lte: horizon } },
      orderBy: [{ date: "asc" }],
      take: 40,
      select: { id: true, date: true, capacity: true, closed: true, note: true, product: { select: { name: true } } },
    }),
    prisma.availabilityDay.aggregate({
      where: { date: { gte: today, lte: horizon } },
      _sum: { capacity: true, booked: true },
      _count: true,
    }),
    prisma.availabilityRule.count({ where: { active: true } }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
  ]);

  return { days, overrides, agenda, ruleCount, publishedTours };
}

export default async function AdminAvailabilityPage() {
  const { days, overrides, agenda, ruleCount, publishedTours } = await load();
  const capacity = agenda._sum.capacity ?? 0;
  const booked = agenda._sum.booked ?? 0;
  const remaining = Math.max(0, capacity - booked);
  const fill = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

  const dayColumns: Column<DayRow>[] = [
    { key: "date", header: "Date", render: (d) => <span className="font-semibold text-slate-900">{fmtDate(d.date)}</span> },
    { key: "tour", header: "Tour", render: (d) => <span className="text-slate-700">{d.product.name}</span> },
    { key: "capacity", header: "Capacity", render: (d) => <span className="text-slate-600">{d.capacity}</span> },
    { key: "booked", header: "Booked", render: (d) => <span className="text-slate-600">{d.booked}</span> },
    {
      key: "left",
      header: "Remaining",
      render: (d) => {
        const left = Math.max(0, d.capacity - d.booked);
        const pct = d.capacity > 0 ? Math.round((d.booked / d.capacity) * 100) : 0;
        return (
          <span className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{left}</span>
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs text-slate-400">{pct}%</span>
          </span>
        );
      },
    },
  ];

  const overrideColumns: Column<OverrideRow>[] = [
    { key: "date", header: "Date", render: (o) => <span className="font-semibold text-slate-900">{fmtDate(o.date)}</span> },
    { key: "tour", header: "Tour", render: (o) => <span className="text-slate-700">{o.product.name}</span> },
    {
      key: "type",
      header: "Type",
      render: (o) => <Badge tone={o.closed ? "red" : "blue"}>{o.closed ? "Blackout" : "Capacity change"}</Badge>,
    },
    { key: "capacity", header: "Capacity", render: (o) => <span className="text-slate-600">{o.capacity ?? "—"}</span> },
    { key: "note", header: "Note", render: (o) => <span className="text-slate-500">{o.note || "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Availability"
        subtitle="Per-day capacity, bookings and blackout dates across the catalogue."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published tours" value={publishedTours} icon="🏝️" />
        <StatCard label="Open days (next 60)" value={agenda._count} icon="🗓️" tone="blue" />
        <StatCard label="Seats sold / capacity" value={`${booked} / ${capacity}`} hint={`${fill}% filled`} icon="🎟️" tone="orange" />
        <StatCard label="Weekly rules" value={ruleCount} hint={`${remaining} seats still open`} icon="🔁" tone="green" />
      </div>

      <DataTable
        columns={dayColumns}
        rows={days}
        rowKey={(d) => d.id}
        emptyTitle="No per-day availability rows yet"
        emptyMessage="Availability rows are created when tours are booked or when suppliers open dates."
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Overrides & blackout dates</h2>
        <DataTable columns={overrideColumns} rows={overrides} rowKey={(o) => o.id} emptyTitle="No overrides in the next 60 days" />
      </section>
    </>
  );
}
