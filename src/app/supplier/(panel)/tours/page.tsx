import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { requireSupplierPanel, productStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Tours" };

export default async function SupplierToursPage() {
  const { supplier } = await requireSupplierPanel();

  const [products, bookingCounts] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        location: true,
        durationLabel: true,
        durationHours: true,
        priceAdultCents: true,
        currency: true,
        defaultCapacity: true,
      },
    }),
    prisma.booking.groupBy({
      by: ["productSlug"],
      where: { supplierId: supplier.id },
      _count: { _all: true },
    }),
  ]);
  const bookingsBySlug = new Map(bookingCounts.map((b) => [b.productSlug, b._count._all]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Tours</h1>
          <p className="mt-1 text-sm text-slate-500">
            All {products.length} tour{products.length === 1 ? "" : "s"} listed under {supplier.companyName}.
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tours yet"
            message="Once an admin approves and publishes your tours, they will appear here with their bookings."
            icon="🧳"
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-bold">Tour</th>
                <th className="px-4 py-3 font-bold">Duration</th>
                <th className="px-4 py-3 text-right font-bold">Adult price</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      /{p.slug}
                      {p.location ? ` · ${p.location}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.durationLabel ?? `${p.durationHours} h`}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {p.priceAdultCents > 0
                      ? formatMoney(p.priceAdultCents, p.currency)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={productStatusTone(p.status)}>{statusLabel(p.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {bookingsBySlug.get(p.slug) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Need a change? Contact support to edit, re-submit or publish a tour —
        new listings are created and approved by the admin team.{" "}
        <Link href="/supplier/bookings" className="font-semibold text-brand-700 hover:underline">
          See bookings →
        </Link>
      </p>
    </>
  );
}
