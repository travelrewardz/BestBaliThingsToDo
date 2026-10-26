import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDuration, parseStringList } from "@/lib/tours";
import { Badge, ButtonLink, Stars } from "@/components/ui";
import { PhotoGallery } from "@/components/PhotoGallery";
import { TourCard } from "@/components/TourCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { BookingWidget } from "@/components/BookingWidget";
import { BookingFlowProvider } from "@/components/BookingFlow";
import { AvailableOptions } from "@/components/AvailableOptions";
import { formatMoney } from "@/lib/money";
import { effectiveFromPriceCents } from "@/lib/tours";
import { mdInline, mdToHtml, mdToText, parseStringArray } from "@/lib/md";
import { buildMetadata, jsonLd, productJsonLd, faqJsonLd, breadcrumbJsonLd, absoluteUrl, getSeoMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

type TourWithRelations = Prisma.ProductGetPayload<{
  include: {
    supplier: true;
    media: true;
    options: { include: { tiers: true; questions: true } };
    destination: true;
    category: true;
    reviews: { include: { customer: true } };
  };
}>;

async function loadTour(slug: string) {
  const tour = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      supplier: true,
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      options: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          tiers: { orderBy: { sortOrder: "asc" } },
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
      destination: { select: { name: true, slug: true } },
      category: { select: { name: true, slug: true } },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { customer: { select: { name: true } } },
      },
    },
  });
  if (!tour) return null;

  // count views for the admin dashboard (best effort, never blocks the page)
  void prisma.product
    .update({ where: { id: tour.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return tour as TourWithRelations;
}

async function relatedTours(tour: TourWithRelations) {
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    id: { not: tour.id },
    OR: [
      ...(tour.destinationId ? [{ destinationId: tour.destinationId }] : []),
      ...(tour.categoryId ? [{ categoryId: tour.categoryId }] : []),
    ],
  };
  const related = where.OR?.length
    ? await prisma.product.findMany({
        where,
        orderBy: [{ ratingAvg: "desc" }, { bookingCount: "desc" }],
        take: 4,
        include: {
          destination: { select: { name: true, slug: true } },
          supplier: { select: { companyName: true } },
          media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
          options: { include: { tiers: { orderBy: { sortOrder: "asc" } } } },
        },
      })
    : [];
  return related;
}

const durationLabel = (tour: { durationLabel: string | null; durationHours: number }) =>
  formatDuration(tour);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = await loadTour(slug);
  if (!tour) return { title: "Tour not found" };

  const meta = await getSeoMeta("PRODUCT", tour.id);
  const image = tour.media[0]?.url ?? null;
  return buildMetadata({
    title: tour.seoTitle || tour.name,
    description: tour.seoDescription || tour.shortDescription || mdToText(tour.description, 160),
    keywords: tour.seoKeywords ? tour.seoKeywords.split(",").map((k) => k.trim()).filter(Boolean) : null,
    path: `/trip/${tour.slug}`,
    image,
    ogTitle: meta?.ogTitle,
    ogDescription: meta?.ogDescription,
    ogImage: meta?.ogImage,
    fallbackTitle: tour.name,
  });
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TickList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <span aria-hidden>✅</span>
          <span dangerouslySetInnerHTML={{ __html: mdInline(item) }} />
        </li>
      ))}
    </ul>
  );
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tour = await loadTour(slug);
  if (!tour) notFound();

  const related = await relatedTours(tour);
  const base = absoluteUrl("/");
  const gallery = tour.media.map((m) => m.url);
  const mainImage = gallery[0] ?? null;
  const effective = effectiveFromPriceCents(tour.priceAdultCents, tour.options);
  const highlights = parseStringArray(tour.highlights);
  const inclusions = parseStringArray(tour.inclusions);
  const exclusions = parseStringArray(tour.exclusions);
  const whatToBring = parseStringArray(tour.whatToBring);
  const itinerary = JSON.parse(tour.itinerary || "[]") as { time?: string; title: string; text?: string }[];
  const faqs = JSON.parse(tour.faq || "[]") as { q: string; a: string }[];
  const validFaqs = faqs.filter((f) => f.q && f.a);

  const jsonLdBlocks = [
    productJsonLd({
      name: tour.name,
      description: tour.shortDescription || mdToText(tour.description, 300),
      url: absoluteUrl(`/trip/${tour.slug}`),
      image: mainImage ? absoluteUrl(mainImage, base) : absoluteUrl("/media/og-default.jpg", base),
      priceCents: effective,
      currency: tour.currency,
      ratingAvg: tour.ratingAvg,
      ratingCount: tour.ratingCount,
      supplierName: tour.supplier.companyName,
      reviews: tour.reviews.map((r) => ({
        author: r.customer.name,
        rating: r.rating,
        body: r.body,
        date: r.createdAt.toISOString().slice(0, 10),
      })),
    }),
    breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        ...(tour.destination ? [{ name: tour.destination.name, path: `/destination/${tour.destination.slug}` }] : []),
        { name: tour.name, path: `/trip/${tour.slug}` },
      ],
      base
    ),
    ...(validFaqs.length && faqJsonLd(validFaqs) ? [faqJsonLd(validFaqs)!] : []),
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@graph": jsonLdBlocks }) }}
      />

      <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="font-semibold text-brand-700 hover:underline">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        {tour.destination && (
          <>
            <span>{tour.destination.name}</span>
            <span className="mx-1.5">/</span>
          </>
        )}
        <span className="text-slate-700">{tour.name}</span>
      </nav>

      {/* Gallery — click any photo to enlarge and browse all of them */}
      <PhotoGallery images={gallery} name={tour.name}>
        <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          {tour.tourType === "PRIVATE" && <Badge tone="brand">Private</Badge>}
          {tour.instantConfirm && <Badge tone="green">Instant confirmation</Badge>}
          {tour.freeCancellation && <Badge tone="neutral">Free cancellation</Badge>}
        </div>
      </PhotoGallery>

      <BookingFlowProvider
        bookingCutoffHours={tour.bookingCutoffHours}
        maxAdvanceDays={tour.maxAdvanceDays}
        minParticipants={tour.minParticipants}
      >
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main content */}
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>📍 {tour.location || tour.destination?.name || "Bali"}</span>
                  <span>·</span>
                  <span>⏱ {durationLabel(tour)}</span>
                  <span>·</span>
                  <span className="uppercase">{tour.difficulty.toLowerCase()}</span>
                </div>
                <h1 className="mt-1 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">{tour.name}</h1>
                {tour.subtitle && <p className="mt-1 text-slate-500">{tour.subtitle}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {tour.ratingCount > 0 ? (
                    <>
                      <Stars rating={tour.ratingAvg} size="md" />
                      <span className="font-bold text-slate-800">{tour.ratingAvg.toFixed(1)}</span>
                      <span className="text-slate-400">({tour.ratingCount} reviews)</span>
                    </>
                  ) : (
                    <span className="text-slate-400">No reviews yet</span>
                  )}
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{tour.bookingCount} bookings</span>
                </div>
              </div>
              <FavoriteButton productId={tour.id} />
            </div>

            <p className="mt-3 text-sm text-slate-600">
              Operated by{" "}
              <span className="font-semibold text-slate-800">{tour.supplier.companyName}</span>
              {tour.category && <> · {tour.category.name}</>}
            </p>
          </div>

          {tour.shortDescription && (
            <p className="text-base leading-relaxed text-slate-700">{tour.shortDescription}</p>
          )}

          <Section title="About this tour">
            <div
              className="prose-bali text-slate-700"
              dangerouslySetInnerHTML={{ __html: mdToHtml(tour.description) }}
            />
          </Section>

          {highlights.length > 0 && (
            <Section title="Highlights">
              <TickList items={highlights} />
            </Section>
          )}

          <AvailableOptions
            productId={tour.id}
            currency={tour.currency}
            options={tour.options.map((o) => ({
              id: o.id,
              name: o.name,
              description: o.description,
              startTime: o.startTime,
              priceAdultCents: o.priceAdultCents,
              priceChildCents: o.priceChildCents,
              priceInfantCents: o.priceInfantCents,
              tiers: o.tiers.map((t) => ({
                minPax: t.minPax,
                maxPax: t.maxPax,
                priceCents: t.priceCents,
              })),
            }))}
            basePrices={{
              adult: tour.priceAdultCents,
              child: tour.priceChildCents,
              infant: tour.priceInfantCents,
            }}
            minPax={tour.minParticipants}
            maxPax={tour.maxParticipants}
          />

          {itinerary.length > 0 && (
            <Section title="Itinerary">
              <ol className="space-y-4">
                {itinerary.map((step, i) => (
                  <li key={i} className="relative border-l-2 border-brand-100 pl-5">
                    <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-brand-600" />
                    <div className="flex flex-wrap items-baseline gap-2">
                      {step.time && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                          {step.time}
                        </span>
                      )}
                      <h3 className="font-display font-bold text-slate-900">{step.title}</h3>
                    </div>
                    {step.text && (
                      <div
                        className="mt-1.5 text-sm text-slate-600 [&_p]:my-1.5"
                        dangerouslySetInnerHTML={{ __html: mdToHtml(step.text) }}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {(inclusions.length > 0 || exclusions.length > 0) && (
            <Section title="What's included">
              <div className="grid gap-6 sm:grid-cols-2">
                {inclusions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Included</h3>
                    <ul className="mt-2 space-y-2">
                      {inclusions.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span aria-hidden>✅</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Not included</h3>
                    <ul className="mt-2 space-y-2">
                      {exclusions.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span aria-hidden>❌</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {whatToBring.length > 0 && (
            <Section title="What to bring">
              <TickList items={whatToBring} />
            </Section>
          )}

          <Section title="Good to know">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Meeting point</dt>
                <dd className="mt-1 text-slate-700">{tour.meetingPoint || "Shared with you after booking"}</dd>
              </div>
              {tour.pickupInfo && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Pickup</dt>
                  <dd className="mt-1 text-slate-700">{tour.pickupInfo}</dd>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Group size</dt>
                <dd className="mt-1 text-slate-700">
                  {tour.minParticipants}–{tour.maxParticipants} travellers ({tour.tourType.toLowerCase()})
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Cancellation</dt>
                <dd className="mt-1 text-slate-700">
                  {tour.freeCancellation
                    ? "Free cancellation — cancel up to 24 hours before the tour."
                    : tour.cancellationPolicy || "Non-refundable unless the supplier cancels."}
                </dd>
              </div>
            </dl>
            {tour.importantInfo && (
              <div
                className="prose-bali mt-4 text-slate-700"
                dangerouslySetInnerHTML={{ __html: mdToHtml(tour.importantInfo) }}
              />
            )}
          </Section>

          {validFaqs.length > 0 && (
            <Section title="Frequently asked questions">
              <div className="divide-y divide-slate-100">
                {validFaqs.map((f, i) => (
                  <details key={i} className="group py-3">
                    <summary className="cursor-pointer list-none font-semibold text-slate-800 marker:content-none">
                      <span className="flex items-start justify-between gap-3">
                        {f.q}
                        <span className="text-slate-400 transition-transform group-open:rotate-45">＋</span>
                      </span>
                    </summary>
                    <p className="mt-2 text-sm text-slate-600">{f.a}</p>
                  </details>
                ))}
              </div>
            </Section>
          )}

          <Section id="reviews" title="Reviews">
            {tour.ratingCount > 0 ? (
              <div className="mb-4 flex items-center gap-3">
                <Stars rating={tour.ratingAvg} size="md" />
                <span className="font-display text-2xl font-extrabold text-slate-900">
                  {tour.ratingAvg.toFixed(1)}
                </span>
                <span className="text-sm text-slate-500">based on {tour.ratingCount} reviews</span>
              </div>
            ) : null}
            {tour.reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet — be the first to book and share your day.</p>
            ) : (
              <ul className="space-y-4">
                {tour.reviews.map((review) => (
                  <li key={review.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={review.rating} />
                      <span className="text-sm font-bold text-slate-800">{review.customer.name}</span>
                      <span className="text-xs text-slate-400">
                        {review.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                    {review.title && <p className="mt-1 font-semibold text-slate-800">{review.title}</p>}
                    <p className="mt-1 text-sm text-slate-600">{review.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Booking sidebar */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BookingWidget
            productId={tour.id}
            name={tour.name}
            currency={tour.currency}
            basePriceCents={effective}
            priceAdultCents={tour.priceAdultCents}
            minParticipants={tour.minParticipants}
            maxParticipants={tour.maxParticipants}
            tourType={tour.tourType}
            options={tour.options.map((o) => ({
              id: o.id,
              name: o.name,
              startTime: o.startTime,
              priceAdultCents: o.priceAdultCents,
              priceChildCents: o.priceChildCents,
              priceInfantCents: o.priceInfantCents,
              tiers: o.tiers.map((t) => ({
                minPax: t.minPax,
                maxPax: t.maxPax,
                priceCents: t.priceCents,
              })),
              questions: o.questions.map((q) => ({
                id: q.id,
                label: q.label,
                type: q.type as "READ_ONLY" | "TEXT" | "SELECT",
                remark: q.remark,
                choices: parseStringList(q.choices),
                required: q.required,
              })),
            }))}
          />
        </div>
      </div>
      </BookingFlowProvider>

      {related.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-slate-900">You may also like</h2>
            <ButtonLink href="/" variant="outline" size="sm">
              Browse all tours
            </ButtonLink>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <TourCard
                key={r.id}
                tour={{
                  id: r.id,
                  slug: r.slug,
                  name: r.name,
                  shortDescription: r.shortDescription,
                  priceAdultCents: r.priceAdultCents,
                  currency: r.currency,
                  durationLabel: r.durationLabel,
                  durationHours: r.durationHours,
                  ratingAvg: r.ratingAvg,
                  ratingCount: r.ratingCount,
                  location: r.location,
                  instantConfirm: r.instantConfirm,
                  freeCancellation: r.freeCancellation,
                  tourType: r.tourType,
                  media: r.media,
                  destination: r.destination,
                  supplier: r.supplier,
                  options: r.options,
                }}
              />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">
        Price from {formatMoney(effective, tour.currency)} · {durationLabel(tour)} · {tour.supplier.companyName}
      </p>
    </div>
  );
}
