import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TourCard } from "@/components/TourCard";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function loadCategory(slug: string) {
  return prisma.category.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true, description: true, icon: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug).catch(() => null);
  if (!category) return { title: "Category not found" };
  return buildMetadata({
    title: category.name,
    description:
      category.description ||
      `Discover the best ${category.name} tours and activities in Bali.`,
    path: `/activity/${category.slug}`,
    fallbackTitle: `${category.name} tours`,
  });
}

export default async function ActivityCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) notFound();

  const [tours, otherCategories] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { categoryId: category.id },
          { categoryLinks: { contains: category.id } },
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
    prisma.category.findMany({
      where: { active: true, kind: "CATEGORY", id: { not: category.id } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true, icon: true },
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
            <span className="text-white">{category.name}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            {category.icon ? `${category.icon} ` : ""}
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-sm text-brand-100 md:text-base">
              {category.description}
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
            No published tours in this category yet — check back soon.
          </p>
        )}

        {otherCategories.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-slate-900">Explore other categories</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {otherCategories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/activity/${c.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
                >
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
