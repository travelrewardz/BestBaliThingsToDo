import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

export async function getSeoSettings() {
  const s = await prisma.seoSetting.findUnique({ where: { key: "site" } });
  return (
    s ?? {
      id: "",
      key: "site",
      siteTitle: "Bali Things To Do",
      siteDescription:
        "Discover the best tours, activities, adventures and experiences in Bali.",
      defaultTitleSuffix: "| Bali Things To Do",
      defaultDescription:
        "Discover the best tours, activities, adventures and experiences in Bali.",
      canonicalBase: "https://www.balithingstodo.net",
      robotsTxt: null as unknown as string | null,
      noindex: false,
      googleVerification: null as unknown as string | null,
      bingVerification: null as unknown as string | null,
      analyticsId: null as unknown as string | null,
      tagManagerId: null as unknown as string | null,
      ogImage: null as unknown as string | null,
      twitterHandle: null as unknown as string | null,
      updatedAt: new Date(),
    }
  );
}

export type SeoMetaRow = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  robots?: string | null;
  focusKeyword?: string | null;
  keywords?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterCard?: string | null;
  schemaJson?: string | null;
} | null;

/** Per-entity SEO row (Admin → SEO), falling back to null when unset. */
export async function getSeoMeta(entityType: string, entityId: string): Promise<SeoMetaRow> {
  return prisma.seoMeta.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
}

export function absoluteUrl(path: string, base = env.appUrl): string {
  return new URL(path, base).toString();
}

// ------------------------------------------------------------
// Metadata
// ------------------------------------------------------------

export function buildMetadata(opts: {
  title?: string | null;
  description?: string | null;
  path: string;
  canonical?: string | null;
  image?: string | null;
  robots?: string | null;
  keywords?: string[] | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterCard?: string | null;
  fallbackTitle?: string;
  fallbackDescription?: string;
  suffix?: string;
}): Metadata {
  const suffix = opts.suffix ?? "| Bali Things To Do";
  const title = opts.title || opts.fallbackTitle || "Bali Things To Do";
  const fullTitle = opts.title ? `${title} ${suffix}` : `${title}`;
  const description =
    opts.description || opts.fallbackDescription ||
    "Discover the best tours, activities, adventures and experiences in Bali.";
  const url = absoluteUrl(opts.path);
  const image = opts.ogImage || opts.image || "/media/og-default.jpg";
  const robotsMeta = (opts.robots || "index,follow") as Metadata["robots"];

  return {
    title: fullTitle,
    description,
    keywords: opts.keywords ?? undefined,
    alternates: { canonical: opts.canonical ? absoluteUrl(opts.canonical) : url },
    robots: robotsMeta,
    openGraph: {
      title: opts.ogTitle || fullTitle,
      description: opts.ogDescription || description,
      url,
      siteName: "Bali Things To Do",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      type: "website",
    },
    twitter: {
      card: (opts.twitterCard as "summary_large_image") || "summary_large_image",
      title: opts.ogTitle || fullTitle,
      description: opts.ogDescription || description,
      images: [image],
    },
  };
}

// ------------------------------------------------------------
// JSON-LD structured data
// ------------------------------------------------------------

export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bali Things To Do",
    url: base,
    logo: `${base}/media/logo.png`,
    sameAs: [
      "https://www.instagram.com/balithingstodo",
      "https://www.facebook.com/balithingstodo",
    ],
  };
}

export function websiteJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bali Things To Do",
    url: base,
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path, base),
    })),
  };
}

export function productJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  image: string;
  priceCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  reviews: { author: string; rating: number; body: string; date: string }[];
  supplierName: string;
  availability?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    image: opts.image,
    offers: {
      "@type": "Offer",
      price: (opts.priceCents / 100).toFixed(2),
      priceCurrency: opts.currency,
      availability: opts.availability || "https://schema.org/InStock",
      url: opts.url,
    },
    provider: { "@type": "Organization", name: opts.supplierName },
    ...(opts.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.ratingAvg.toFixed(1),
            reviewCount: opts.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(opts.reviews.length
      ? {
          review: opts.reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            datePublished: r.date,
            reviewBody: r.body,
          })),
        }
      : {}),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function localBusinessJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "Bali Things To Do",
    url: base,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ubud",
      addressRegion: "Bali",
      addressCountry: "ID",
    },
    priceRange: "$$",
  };
}
