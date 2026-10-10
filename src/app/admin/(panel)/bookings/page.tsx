import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge, Pagination } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { bookingStatusTone, statusLabel } from "@/lib/supplier";
import { formatMoney } from "@/lib/money";
import { fmtDate, pageParam } from "@/lib/admin";

export const metadata: Metadata = { title: "Bookings" };

const PER_PAGE = 25;
const FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "upcoming", label: "Upcoming", statuses: ["PAID", "CONFIRMED", "SUPPLIER_CONFIRMATION_REQUIRED"] },
  { key: "pending", label: "Pending", statuses: ["PENDING", "AWAITING_PAYMENT"] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Cancelled / refund", statuses: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED", "NO_SHOW"] },
] as const;

type Row = Awaited<ReturnType<typeof load>>["rows"][number];

async function load(where: Prisma.BookingWhereInput, page: number) {
  return {
    total: await prisma.booking.count({ where }),
    rows: await prisma.booking.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        reference: true,
        productName: true,
        customerName: true,
        customerEmail: true,
        tourDate: true,
        totalTravelers: true,
        totalCents: true,
        currency: true,
        commissionCents: true,
        status: true,
        supplier: { select: { companyName: true } },
      },
    }),
  };
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const where: Prisma.BookingWhereInput = filter.statuses ? { status: { in: [...filter.statuses] } } : {};
  const total = await prisma.booking.count({ where });
  const page = pageParam(sp.page, PER_PAGE, total);
  const { rows } = await load(where, page);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      render: (b) => <span className="font-mono text-xs font-semibold text-slate-900">{b.reference}</span>,
    },
    {
      key: "tour",
      header: "Tour / supplier",
      render: (b) => (
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">{b.productName}</span>
          <span className="block text-xs text-slate-400">{b.supplier.companyName}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (b) => (
        <span className="min-w-0">
          <span className="block text-slate-700">{b.customerName}</span>
          <span className="block text-xs text-slate-400">{b.customerEmail}</span>
        </span>
      ),
    },
    { key: "date", header: "Tour date", render: (b) => <span className="text-slate-600">{fmtDate(b.tourDate)}</span> },
    { key: "pax", header: "Pax", render: (b) => <span className="text-slate-600">{b.totalTravelers}</span> },
    {
      key: "total",
      header: "Total",
      render: (b) => <span className="font-semibold text-slate-900">{formatMoney(b.totalCents, b.currency)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (b) => <Badge tone={bookingStatusTone(b.status)}>{statusLabel(b.status)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Sales" title="Bookings" subtitle={`${total} booking${total === 1 ? "" : "s"} in the current view.`} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/bookings?status=${f.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              f.key === filter.key ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(b) => b.id} emptyTitle="No bookings in this view" />
      <Pagination page={page} pages={pages} basePath="/admin/bookings" params={{ status: filter.key }} />
    </>
  );
}
