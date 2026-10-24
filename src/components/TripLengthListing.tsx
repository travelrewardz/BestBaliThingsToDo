import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tripLengthWhere } from "@/lib/search";
import { TourCard } from "@/components/TourCard";

export type TripLength = "day" | "multiday";

const COPY: Record<
  TripLength,
  { icon: string; title: string; blurb: string; other: TripLength; otherLabel: string }
> = {
  day: {
    icon: "🕗",
    title: "1 Day Trips",
    blurb:
      "Tours that start and finish the same day — pack a bag, be back at your hotel by evening.",
    other: "multiday",
    otherLabel: "Multi-day trips",
  },
  multiday: {
    icon: "🧳",
    title: "Multi-day Trips",
    blurb:
      "Tours that span 24 hours or more — island hops, sunrise-to-sunset adventures and overnight journeys across Bali.",
    other: "day",
    otherLabel: "1 Day trips",
  },
};

export const TRIP_LENGTH_ROUTES: Record<TripLength, string> = {
  day: "/day-trips",
  multiday: "/multi-day-trips",
};

export async function TripLengthListing({ length }: { length: TripLength }) {
  const copy = COPY[length];

  const [tours, otherTours] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PUBLISHED", ...tripLengthWhere(length) },
      orderBy: [{ bookingCount: "desc" }, { ratingAvg: "desc" }],
      include: {
        destination: { select: { name: true, slug: true } },
        supplier: { select: { companyName: true } },
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        options: { include: { tiers: { orderBy: { sortOrder: "asc" } } } },
      },
    }),
    prisma.product.count({
      where: { status: "PUBLISHED", ...tripLengthWhere(copy.other) },
    }),
  ]);

  return (
    <>
      <section className="bg-brand-900">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <nav className="text-xs font-semibold text-brand-200" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-brand-400">/</span>
            <span className="text-white">{copy.title}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            {copy.icon} {copy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-brand-100 md:text-base">{copy.blurb}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-sunset-300">
            {tours.length} {tours.length === 1 ? "experience" : "experiences"} available
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        {tours.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tours.map((t, i) => (
              <TourCard key={t.id} tour={t} priority={i < 4} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No published tours in this group yet — check back soon.
          </p>
        )}

        {otherTours > 0 && (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-sand-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-700">
              Looking for something {length === "day" ? "longer" : "shorter"}?
            </p>
            <Link
              href={TRIP_LENGTH_ROUTES[copy.other]}
              className="mt-2 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800"
            >
              Browse {copy.otherLabel} →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
