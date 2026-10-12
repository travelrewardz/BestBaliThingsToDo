import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { Badge, ButtonLink, EmptyState, SmartImage } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { bookingStatusTone, statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Customer area: profile, bookings and favorites. */
export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "SUPPLIER") redirect("/supplier");

  const [bookings, favoriteCount] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.favorite.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">My account</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.name} · {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/" variant="outline" size="sm">
            Browse tours
          </ButtonLink>
          <SignOutButton />
        </div>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-slate-900">My bookings</h2>
          <span className="text-sm text-slate-500">{favoriteCount} saved tour{favoriteCount === 1 ? "" : "s"}</span>
        </div>

        {bookings.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No bookings yet"
              message="When you book a tour it will show up here with its voucher and status."
              action={
                <ButtonLink href="/" variant="dark" size="sm">
                  Find a tour
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {bookings.map((b) => {
              const date = b.tourDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    <SmartImage src={b.productImage} alt={b.productName} fill sizes="112px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/booking/${b.reference}`}
                      className="font-display font-bold text-slate-900 hover:text-brand-700"
                    >
                      {b.productName}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {date}
                      {b.tourTime ? ` · ${b.tourTime}` : ""} · {b.totalTravelers} traveller
                      {b.totalTravelers === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{b.reference}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge tone={bookingStatusTone(b.status)}>{statusLabel(b.status)}</Badge>
                    <span className="font-bold text-slate-900">{formatMoney(b.totalCents, b.currency)}</span>
                    <Link href={`/booking/${b.reference}`} className="text-sm font-semibold text-brand-700 hover:underline">
                      View →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
