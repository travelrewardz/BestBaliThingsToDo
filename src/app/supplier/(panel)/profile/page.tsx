import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { SupplierProfileForm } from "@/components/SupplierProfileForm";
import { requireSupplierPanel, supplierStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Profile" };

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Makassar" });

export default async function SupplierProfilePage() {
  const { user, supplier } = await requireSupplierPanel();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-slate-900">Profile</h1>
        <Badge tone={supplierStatusTone(supplier.status)}>{statusLabel(supplier.status)}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        How your company appears across the marketplace.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SupplierProfileForm
            initial={{
              companyName: supplier.companyName,
              email: supplier.email,
              phone: supplier.phone ?? "",
              whatsapp: supplier.whatsapp ?? "",
              website: supplier.website ?? "",
              address: supplier.address ?? "",
              city: supplier.city ?? "",
              description: supplier.description ?? "",
            }}
          />
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Account
            </h2>
            <dl className="mt-3 space-y-2.5">
              <div>
                <dt className="text-slate-500">Login email</dt>
                <dd className="font-semibold text-slate-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Supplier ID</dt>
                <dd className="font-mono text-xs text-slate-700">{supplier.id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Public slug</dt>
                <dd className="font-mono text-xs text-slate-700">/{supplier.slug}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Member since</dt>
                <dd className="text-slate-900">{DATE_FMT.format(supplier.createdAt)}</dd>
              </div>
              {supplier.approvedAt && (
                <div>
                  <dt className="text-slate-500">Approved</dt>
                  <dd className="text-slate-900">{DATE_FMT.format(supplier.approvedAt)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Performance
            </h2>
            <dl className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Rating</dt>
                <dd className="font-semibold text-slate-900">
                  {supplier.ratingCount > 0
                    ? `★ ${supplier.ratingAvg.toFixed(1)} (${supplier.ratingCount})`
                    : "No reviews yet"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Total bookings</dt>
                <dd className="font-semibold text-slate-900">{supplier.totalBookings}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Commission rate</dt>
                <dd className="font-semibold text-slate-900">
                  {supplier.commissionRateBps != null
                    ? `${(supplier.commissionRateBps / 100).toFixed(1)}%`
                    : "Default"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
