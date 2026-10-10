import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyState, Pagination } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { requireSupplierPanel, bookingStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Bookings" };

const PAGE_SIZE = 20;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "action", label: "Needs action" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function whereFor(supplierId: string, filter: FilterKey) {
  const base = { supplierId };
  switch (filter) {
    case "upcoming":
      return {
        ...base,
        tourDate: { gte: startOfToday() },
        status: { notIn: ["CANCELLED", "REFUNDED", "NO_SHOW"] },
      };
    case "action":
      return { ...base, status: { in: ["SUPPLIER_CONFIRMATION_REQUIRED", "REFUND_REQUESTED"] } };
    case "completed":
      return { ...base, status: "COMPLETED" };
    case "cancelled":
      return { ...base, status: { in: ["CANCELLED", "REFUNDED", "NO_SHOW"] } };
    default:
      return base;
  }
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Makassar",
});

export default async function SupplierBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { supplier } = await requireSupplierPanel();
  const params = await searchParams;

  const requested = params.status as FilterKey | undefined;
  const filter: FilterKey = FILTERS.some((f) => f.key === requested) ? requested! : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const where = whereFor(supplier.id, filter);

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: [{ tourDate: "asc" }, { tourTime: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        productName: true,
        status: true,
        tourDate: true,
        tourTime: true,
        pickupLocation: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        adults: true,
        children: true,
        infants: true,
        totalCents: true,
        supplierEarningsCents: true,
        currency: true,
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Bookings</h1>
        <p className="mt-1 text-sm text-slate-500">
          {total} booking{total === 1 ? "" : "s"}
          {filter !== "all" ? ` in “${FILTERS.find((f) => f.key === filter)?.label}”` : ""} ·
          dates shown in Bali time (WITA).
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/supplier/bookings" : `/supplier/bookings?status=${f.key}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                active
                  ? "bg-brand-700 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {bookings.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No bookings here"
            message={
              filter === "all"
                ? "New bookings for your tours will show up here."
                : "Try a different filter."
            }
            icon="📅"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {bookings.map((b) => (
            <article
              key={b.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {b.reference}
                    </span>
                    <Badge tone={bookingStatusTone(b.status)}>{statusLabel(b.status)}</Badge>
                  </div>
                  <h2 className="mt-1 font-semibold text-slate-900">{b.productName}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {DATE_FMT.format(b.tourDate)}
                    {b.tourTime ? ` · ${b.tourTime}` : ""}
                    {" · "}
                    {b.adults} adult{b.adults === 1 ? "" : "s"}
                    {b.children > 0 ? `, ${b.children} child` : ""}
                    {b.infants > 0 ? `, ${b.infants} infant` : ""}
                    {b.pickupLocation ? ` · pickup: ${b.pickupLocation}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">
                    {formatMoney(b.totalCents, b.currency)}
                  </div>
                  <div className="text-xs text-slate-500">
                    your share {formatMoney(b.supplierEarningsCents, b.currency)}
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">{b.customerName}</span>
                {" · "}
                <a href={`mailto:${b.customerEmail}`} className="text-brand-700 hover:underline">
                  {b.customerEmail}
                </a>
                {b.customerPhone && (
                  <>
                    {" · "}
                    <a
                      href={`tel:${b.customerPhone}`}
                      className="text-brand-700 hover:underline"
                    >
                      {b.customerPhone}
                    </a>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} basePath="/supplier/bookings" params={{ status: filter === "all" ? undefined : filter }} />
    </>
  );
}
