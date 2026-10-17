import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { Badge, SmartImage } from "@/components/ui";
import { PaymentPanel } from "@/components/PaymentPanel";
import { bookingStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_HELP: Record<string, string> = {
  AWAITING_PAYMENT: "Choose a payment method to lock in your booking.",
  PENDING: "We received your booking and are waiting for the supplier to confirm it.",
  SUPPLIER_CONFIRMATION_REQUIRED: "The supplier will confirm your booking shortly.",
  PAID: "Payment received — your booking is being confirmed.",
  CONFIRMED: "You're all set! Your voucher is on its way to your email.",
  COMPLETED: "This tour has been completed. We'd love to hear how it went.",
  CANCELLED: "This booking was cancelled.",
  REFUND_REQUESTED: "A refund has been requested for this booking.",
  REFUNDED: "This booking was refunded.",
  NO_SHOW: "This booking was marked as a no-show.",
};

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/checkout/${encodeURIComponent(id)}`);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { items: true, answers: { orderBy: { sortOrder: "asc" } } },
  });
  if (!booking) notFound();
  if (user.role === "CUSTOMER" && booking.customerId !== user.id) notFound();

  const awaitingPayment = ["AWAITING_PAYMENT", "PENDING"].includes(booking.status);
  const travelDate = booking.tourDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10">
      <p className="text-sm font-semibold text-brand-700">
        <Link href={`/trip/${booking.productSlug}`} className="hover:underline">
          ← Back to the tour
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Checkout</h1>
          <p className="mt-1 text-sm text-slate-500">
            Booking reference <span className="font-mono font-bold text-slate-700">{booking.reference}</span>
          </p>
        </div>
        <Badge tone={bookingStatusTone(booking.status)}>{statusLabel(booking.status)}</Badge>
      </div>
      {STATUS_HELP[booking.status] && (
        <p className="mt-2 text-sm text-slate-600">{STATUS_HELP[booking.status]}</p>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                <SmartImage src={booking.productImage} alt={booking.productName} fill sizes="128px" />
              </div>
              <div className="min-w-0">
                <Link
                  href={`/trip/${booking.productSlug}`}
                  className="font-display font-bold text-slate-900 hover:text-brand-700"
                >
                  {booking.productName}
                </Link>
                <p className="mt-1 text-sm text-slate-600">📅 {travelDate}</p>
                {booking.tourTime && <p className="text-sm text-slate-600">⏰ Start time {booking.tourTime}</p>}
                <p className="mt-1 text-sm text-slate-600">
                  👥 {booking.adults} adult{booking.adults === 1 ? "" : "s"}
                  {booking.children > 0 ? `, ${booking.children} child${booking.children === 1 ? "" : "ren"}` : ""}
                  {booking.infants > 0 ? `, ${booking.infants} infant${booking.infants === 1 ? "" : "s"}` : ""}
                </p>
              </div>
            </div>

            <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Lead traveller</dt>
                <dd className="mt-0.5 text-slate-700">{booking.customerName}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-0.5 text-slate-700">{booking.customerEmail}</dd>
              </div>
              {booking.pickupLocation && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Pickup</dt>
                  <dd className="mt-0.5 text-slate-700">{booking.pickupLocation}</dd>
                </div>
              )}
              {booking.specialRequests && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Special requests</dt>
                  <dd className="mt-0.5 text-slate-700">{booking.specialRequests}</dd>
                </div>
              )}
              {booking.answers.length > 0 && (
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Additional info
                  </dt>
                  <dd className="mt-1 space-y-1">
                    {booking.answers.map((a) => (
                      <p key={a.id} className="text-sm text-slate-700">
                        <span className="font-semibold">{a.label}</span>{" "}
                        <span>{a.value || "—"}</span>
                      </p>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <PaymentPanel
            bookingId={booking.id}
            reference={booking.reference}
            awaitingPayment={awaitingPayment}
          />
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-slate-900">Price summary</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd>{formatMoney(booking.subtotalCents, booking.currency)}</dd>
            </div>
            {booking.discountCents > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount{booking.couponCode ? ` · ${booking.couponCode}` : ""}</dt>
                <dd>−{formatMoney(booking.discountCents, booking.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold text-slate-900">
              <dt>Total</dt>
              <dd>{formatMoney(booking.totalCents, booking.currency)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            Supplier: {booking.supplierId ? "Bali Things To Do partner" : "—"} · Reference {booking.reference}
          </p>
        </aside>
      </div>
    </div>
  );
}
