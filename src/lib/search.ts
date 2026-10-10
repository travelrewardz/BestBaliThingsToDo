import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SearchInput = {
  q?: string;
  destination?: string; // slug
  category?: string; // slug (category or activity)
  minPrice?: number; // dollars
  maxPrice?: number;
  duration?: string; // short | full | multiday
  rating?: number;
  type?: string; // GROUP | PRIVATE
  pickup?: boolean;
  instant?: boolean;
  family?: boolean;
  language?: string;
  difficulty?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  supplier?: string; // slug
  status?: string; // default PUBLISHED
};

export type SearchResult = {
  items: Awaited<ReturnType<typeof prisma.product.findMany>> & Record<string, unknown>[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

/**
 * Product search. Initial implementation queries the relational DB directly
 * (adequate for tens of thousands of listings) — the interface is designed
 * so Elasticsearch/OpenSearch or Algolia can be swapped in later.
 */
export function buildProductWhere(input: SearchInput): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    status: input.status ?? "PUBLISHED",
  };

  if (input.q) {
    const q = input.q.trim();
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { shortTitle: { contains: q } },
        { subtitle: { contains: q } },
        { location: { contains: q } },
        { description: { contains: q } },
        { supplier: { companyName: { contains: q } } },
        { destination: { name: { contains: q } } },
        { category: { name: { contains: q } } },
      ];
    }
  }
  if (input.destination) where.destination = { slug: input.destination };
  if (input.supplier) where.supplier = { slug: input.supplier };
  if (input.category) where.category = { slug: input.category };
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    where.priceAdultCents = {
      ...(input.minPrice !== undefined ? { gte: Math.round(input.minPrice * 100) } : {}),
      ...(input.maxPrice !== undefined ? { lte: Math.round(input.maxPrice * 100) } : {}),
    };
  }
  if (input.rating) where.ratingAvg = { gte: input.rating };
  if (input.type === "GROUP" || input.type === "PRIVATE") where.tourType = input.type;
  if (input.pickup) where.pickupLocations = { not: null };
  if (input.instant) where.instantConfirm = true;
  if (input.family) where.familyFriendly = true;
  if (input.difficulty) where.difficulty = input.difficulty;
  if (input.language) where.languages = { contains: input.language };
  if (input.duration === "short") where.durationHours = { lte: 4 };
  if (input.duration === "full") where.durationHours = { gt: 4, lte: 8 };
  if (input.duration === "multiday") where.durationHours = { gt: 8 };

  return where;
}

function orderByFor(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ priceAdultCents: "asc" }];
    case "price_desc":
      return [{ priceAdultCents: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
    case "newest":
      return [{ publishedAt: "desc" }];
    case "bestselling":
      return [{ bookingCount: "desc" }];
    case "popular":
      return [{ viewCount: "desc" }, { bookingCount: "desc" }];
    case "recommended":
    default:
      return [{ bookingCount: "desc" }, { ratingAvg: "desc" }];
  }
}

function relevanceScore(
  p: { name: string; shortTitle: string | null; location: string | null; bookingCount: number; ratingAvg: number },
  q: string
): number {
  const needle = q.toLowerCase();
  let score = 0;
  if (p.name.toLowerCase().includes(needle)) score += 50;
  if (p.name.toLowerCase().startsWith(needle)) score += 20;
  if (p.shortTitle?.toLowerCase().includes(needle)) score += 15;
  if (p.location?.toLowerCase().includes(needle)) score += 10;
  score += Math.log2(p.bookingCount + 1) * 4 + p.ratingAvg * 6;
  return score;
}

export async function searchProducts(input: SearchInput) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const perPage = Math.min(60, Math.max(1, Math.floor(input.perPage || 12)));
  const where = buildProductWhere(input);

  // For text queries, fetch a bounded candidate set and rank in-process so
  // matches in title outrank incidental description mentions.
  if (input.q?.trim()) {
    const candidates = await prisma.product.findMany({
      where,
      orderBy: orderByFor(input.sort),
      take: 300,
      include: {
        destination: true,
        category: true,
        supplier: { select: { companyName: true, slug: true } },
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    });
    const ranked = candidates
      .map((p) => ({ p, s: relevanceScore(p, input.q!.trim()) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
    const total = ranked.length;
    const start = (page - 1) * perPage;
    return {
      items: ranked.slice(start, start + perPage),
      total,
      page,
      perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: orderByFor(input.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        destination: true,
        category: true,
        supplier: { select: { companyName: true, slug: true } },
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Popular / related listings used across the storefront. */
export async function popularProducts(limit = 8, opts?: { category?: string; destination?: string; exclude?: string }) {
  return prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(opts?.category ? { category: { slug: opts.category } } : {}),
      ...(opts?.destination ? { destination: { slug: opts.destination } } : {}),
      ...(opts?.exclude ? { id: { not: opts.exclude } } : {}),
    },
    orderBy: [{ bookingCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
    include: {
      destination: true,
      category: true,
      supplier: { select: { companyName: true } },
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
}
