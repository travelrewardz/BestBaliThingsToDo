import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { Badge, ButtonLink } from "@/components/ui";
import { bookingStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "Booking confirmation", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Confirmation page for a booking reference (e.g. after a redirect payment). */
export default async function BookingConfirmationPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/booking/${encodeURIComponent(ref)}`);

  const booking = await prisma.booking.findUnique({ where: { reference: ref } });
  if (!booking) notFound();
  if (user.role === "CUSTOMER" && booking.customerId !== user.id) notFound();

  const travelDate = booking.tourDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const awaitingPayment = ["AWAITING_PAYMENT", "PENDING"].includes(booking.status);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-slate-900">
          {awaitingPayment ? "Booking received" : "Booking confirmed"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thanks {booking.customerName.split(" ")[0]}! Reference{" "}
          <span className="font-mono font-bold text-slate-800">{booking.reference}</span>
        </p>
        <div className="mt-3 flex justify-center">
          <Badge tone={bookingStatusTone(booking.status)}>{statusLabel(booking.status)}</Badge>
        </div>

        <dl className="mt-6 space-y-2 text-left text-sm">
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Tour</dt>
            <dd className="text-right font-semibold text-slate-800">{booking.productName}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Date</dt>
            <dd className="text-right font-semibold text-slate-800">
              {travelDate}
              {booking.tourTime ? ` · ${booking.tourTime}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Travellers</dt>
            <dd className="text-right font-semibold text-slate-800">{booking.totalTravelers}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Total</dt>
            <dd className="text-right font-extrabold text-slate-900">
              {formatMoney(booking.totalCents, booking.currency)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href={`/checkout/${booking.id}`} variant="dark">
            {awaitingPayment ? "Complete payment" : "View booking"}
          </ButtonLink>
          <ButtonLink href={`/trip/${booking.productSlug}`} variant="outline">
            Back to the tour
          </ButtonLink>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          A confirmation email was sent to {booking.customerEmail}.
        </p>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/" className="font-semibold text-brand-700 hover:underline">
          Keep exploring Bali →
        </Link>
      </p>
    </div>
  );
}
