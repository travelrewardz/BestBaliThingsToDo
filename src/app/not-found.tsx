import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { popularProducts } from "@/lib/search";
import { TourCard } from "@/components/TourCard";
import { ButtonLink } from "@/components/ui";
import { SearchBox } from "@/components/SearchBox";

async function NotFoundContent() {
  const [tours, destinations] = await Promise.all([
    popularProducts(4).catch(() => []),
    prisma.destination.findMany({ where: { active: true }, take: 6, orderBy: { sortOrder: "asc" } }).catch(() => []),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <p className="text-7xl">🗺️</p>
      <h1 className="mt-4 font-display text-4xl font-bold">Page not found</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or has moved. Try searching,
        or jump back into the fun below.
      </p>
      <div className="mx-auto mt-6 max-w-2xl text-left">
        <SearchBox compact />
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/" variant="primary">Go to homepage</ButtonLink>
        <ButtonLink href="/search" variant="outline">Browse all tours</ButtonLink>
      </div>

      {destinations.length > 0 && (
        <div className="mt-12 text-left">
          <h2 className="text-lg font-bold">Popular destinations</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {destinations.map((d) => (
              <Link
                key={d.id}
                href={`/destination/${d.slug}`}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
              >
                {d.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {tours.length > 0 && (
        <div className="mt-10 text-left">
          <h2 className="text-lg font-bold">Popular tours</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tours.map((t) => (
              <TourCard key={t.id} tour={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotFound() {
  return <NotFoundContent />;
}
