import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TourCard } from "@/components/TourCard";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function loadDestination(slug: string) {
  return prisma.destination.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true, region: true, description: true, intro: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await loadDestination(slug).catch(() => null);
  if (!destination) return { title: "Destination not found" };
  return buildMetadata({
    title: destination.name,
    description:
      destination.intro ||
      destination.description ||
      `Tours, activities and experiences in ${destination.name}, Bali.`,
    path: `/destination/${destination.slug}`,
    fallbackTitle: `${destination.name} tours`,
  });
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await loadDestination(slug);
  if (!destination) notFound();

  const [tours, otherDestinations] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { destinationId: destination.id },
          { destinationLinks: { contains: destination.id } },
        ],
      },
      orderBy: [{ bookingCount: "desc" }, { ratingAvg: "desc" }],
      include: {
        destination: { select: { name: true, slug: true } },
        supplier: { select: { companyName: true } },
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        options: { include: { tiers: { orderBy: { sortOrder: "asc" } } } },
      },
    }),
    prisma.destination.findMany({
      where: { active: true, id: { not: destination.id } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true },
      take: 12,
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
            <span className="text-white">{destination.name}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            {destination.region ? `📍 ${destination.name}` : destination.name}
          </h1>
          {(destination.intro || destination.description) && (
            <p className="mt-3 max-w-2xl text-sm text-brand-100 md:text-base">
              {destination.intro || destination.description}
            </p>
          )}
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
            No published tours in this destination yet — check back soon.
          </p>
        )}

        {otherDestinations.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-slate-900">Explore other destinations</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {otherDestinations.map((d) => (
                <Link
                  key={d.slug}
                  href={`/destination/${d.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
                >
                  {d.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
