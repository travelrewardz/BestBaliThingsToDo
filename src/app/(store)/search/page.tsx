import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { popularProducts, searchProducts } from "@/lib/search";
import { buildMetadata } from "@/lib/seo";
import { TourCard } from "@/components/TourCard";
import { SearchBox } from "@/components/SearchBox";
import { ButtonLink, Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Site search — the target of the header search box, the footer "All tours"
 * link and the "Browse all tours" button on the 404 page. Without a keyword
 * it lists the whole published catalogue.
 */

const SORTS = [
  { key: "", label: "Recommended" },
  { key: "price_asc", label: "Lowest price" },
  { key: "price_desc", label: "Highest price" },
  { key: "rating", label: "Top rated" },
  { key: "newest", label: "Newest" },
];

type SearchParams = { q?: string; page?: string; sort?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  return buildMetadata({
    title: q ? `Search: ${q}` : "All tours",
    description: q
      ? `Bali tours and activities matching “${q}” — book with trusted local suppliers.`
      : "Browse every published Bali tour and activity in one place.",
    path: q ? `/search?q=${encodeURIComponent(q)}` : "/search",
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = SORTS.some((s) => s.key === (sp.sort ?? "")) ? sp.sort : undefined;

  const [result, activities] = await Promise.all([
    searchProducts({ q: q || undefined, page, perPage: 12, sort }),
    prisma.category.findMany({
      where: { active: true, kind: "ACTIVITY" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true, icon: true },
    }),
  ]);

  const popular = result.items.length === 0 ? await popularProducts(4).catch(() => []) : [];

  const link = (opts: { q?: string; sort?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.page && opts.page > 1) params.set("page", String(opts.page));
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <section className="bg-brand-900">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <nav className="text-xs font-semibold text-brand-200" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-brand-400">/</span>
            <span className="text-white">{q ? "Search" : "All tours"}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            {q ? <>Results for “{q}”</> : "🧭 All tours"}
          </h1>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-sunset-300">
            {result.total} {result.total === 1 ? "experience" : "experiences"} found
          </p>
          <div className="mt-6 max-w-3xl">
            <SearchBox compact activities={activities} initialQuery={q} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-500">Sort:</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={link({ q, sort: s.key })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                (sort ?? "") === s.key
                  ? "bg-brand-700 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {result.items.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {result.items.map((t, i) => (
              <TourCard key={t.id} tour={t} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-5xl">🔍</p>
            <h2 className="mt-3 font-display text-xl font-bold text-slate-900">
              {q ? <>No tours match “{q}”</> : "No tours published yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {q
                ? "Try another keyword, or jump into one of these activities."
                : "Check back soon — new experiences are added all the time."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {activities.slice(0, 8).map((a) => (
                <Link
                  key={a.slug}
                  href={`/activity/${a.slug}`}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
                >
                  {a.icon ? `${a.icon} ` : ""}
                  {a.name}
                </Link>
              ))}
              {q && (
                <ButtonLink href="/search" variant="outline">
                  Browse all tours
                </ButtonLink>
              )}
            </div>
          </div>
        )}

        {popular.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold">Popular right now</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((t) => (
                <TourCard key={t.id} tour={t} />
              ))}
            </div>
          </div>
        )}

        <Pagination
          page={result.page}
          pages={result.pages}
          basePath="/search"
          params={{ q: q || undefined, sort }}
        />
      </section>
    </>
  );
}
