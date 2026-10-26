import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SearchBox } from "@/components/SearchBox";
import { TourCard } from "@/components/TourCard";
import { Stars, SmartImage, ButtonLink } from "@/components/ui";
import { DestinationGrid, type DestinationTile } from "@/components/DestinationGrid";
import { popularProducts } from "@/lib/search";
import { mdToText } from "@/lib/md";

export const revalidate = 300; // ISR: homepage refreshes every 5 minutes

const DESTINATIONS = [
  { name: "Ubud", slug: "ubud", emoji: "🎑" },
  { name: "Canggu", slug: "canggu", emoji: "🏄" },
  { name: "Seminyak", slug: "seminyak", emoji: "🍹" },
  { name: "Kuta", slug: "kuta", emoji: "🏖️" },
  { name: "Uluwatu", slug: "uluwatu", emoji: "🌅" },
  { name: "Nusa Penida", slug: "nusa-penida", emoji: "🏝️" },
  { name: "Kintamani", slug: "kintamani", emoji: "🌋" },
  { name: "Mount Batur", slug: "mount-batur", emoji: "⛰️" },
];

const WHY = [
  { title: "Local Bali experts", text: "Handpicked experiences by people who live here.", emoji: "🧑‍🌾" },
  { title: "Trusted suppliers", text: "Every operator is reviewed and verified.", emoji: "✅" },
  { title: "Best experiences", text: "Top-rated tours across the island.", emoji: "⭐" },
  { title: "Secure booking", text: "Safe payments and instant confirmation.", emoji: "🔒" },
  { title: "Flexible options", text: "Free cancellation on most tours.", emoji: "🗓️" },
  { title: "Customer support", text: "Real humans on WhatsApp, 7 days a week.", emoji: "💬" },
];

/** One homepage tour block: heading, "View all" link and a card grid. */
function TourSection({
  title,
  blurb,
  href,
  tours,
  priority = false,
}: {
  title: string;
  blurb: string;
  href: string;
  tours: Awaited<ReturnType<typeof popularProducts>>;
  priority?: boolean;
}) {
  return (
    <section className="bg-sand-50 py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
            <p className="mt-1 text-slate-500">{blurb}</p>
          </div>
          <ButtonLink href={href} variant="outline" size="sm">
            View all →
          </ButtonLink>
        </div>
        {tours.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tours.map((t, i) => (
              <TourCard key={t.id} tour={t} priority={priority && i < 4} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Nothing published in this group yet — check back soon.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [dayTours, multidayTours, banners, destinations, categories, activities, testimonials, posts, faqs, stats] =
    await Promise.all([
      popularProducts(8, { tripLength: "DAY" }),
      popularProducts(8, { tripLength: "MULTIDAY" }),
      prisma.banner.findMany({ where: { active: true, position: "HOME" }, orderBy: { sortOrder: "asc" } }),
      prisma.destination.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.category.findMany({
        where: { active: true, kind: "CATEGORY" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.category.findMany({
        where: { active: true, kind: "ACTIVITY" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.review.findMany({
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { product: { select: { name: true, slug: true } }, customer: { select: { name: true } } },
      }),
      prisma.blogPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      prisma.faq.findMany({ where: { scope: "SITE", active: true }, orderBy: { sortOrder: "asc" }, take: 5 }),
      prisma.setting.findMany({ where: { key: { in: ["site_title_stats"] } } }),
    ]);
  void stats;

  const destinationTiles: DestinationTile[] = destinations.length
    ? destinations.map((d) => ({ id: d.id, name: d.name, slug: d.slug, heroImage: d.heroImage }))
    : DESTINATIONS.map((d) => ({ id: d.slug, name: d.name, slug: d.slug, emoji: d.emoji }));

  // Promotional banner: CMS-managed HOME banners win; with none active the
  // homepage still carries its default promo.
  const bannerItems: {
    id: string;
    title: string;
    subtitle?: string;
    pill: string;
    href: string;
    image?: string | null;
  }[] = banners.length
    ? banners.map((b) => ({
        id: b.id,
        title: b.title,
        pill: "Featured offer",
        href: b.link || "/search",
        image: b.imageUrl,
      }))
    : [
        {
          id: "default-promo",
          pill: "Plan your trip",
          title: "Book Bali's best experiences in minutes",
          subtitle: "Instant confirmation · Free cancellation · verified local suppliers.",
          href: "/search",
          image: "/media/hero-uluwatu-sunset.webp",
        },
      ];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-brand-900">
        <div className="absolute inset-0">
          <SmartImage src="/media/hero-uluwatu-sunset.webp" alt="" fill priority sizes="100vw" />
          {/* Keep the headline, search bar and badges readable over the photo. */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/80 to-brand-900/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-900/70 via-transparent to-brand-900/40" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sunset-300">
              Bali&apos;s #1 experiences marketplace
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight text-white md:text-6xl">
              Best Bali Things To Do
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100 md:text-xl">
              Discover Bali&apos;s best tours, activities, adventures and experiences —
              book with trusted local suppliers in minutes.
            </p>
          </div>
          <div className="mt-8 max-w-4xl">
            <SearchBox activities={activities.map((a) => ({ name: a.name, slug: a.slug, icon: a.icon }))} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-brand-100">
            {["Instant confirmation", "Free cancellation", "Verified suppliers", "Secure payment"].map(
              (t) => (
                <span key={t} className="rounded-full bg-white/10 px-3 py-1.5">
                  ✓ {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold md:text-3xl">Explore by category</h2>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/activity/${c.slug}`}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span className="text-2xl">{c.icon || "🏷️"}</span>
              <span className="text-xs font-semibold text-slate-700">{c.name}</span>
            </Link>
          ))}
        </div>
        {activities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activities.map((c) => (
              <Link
                key={c.id}
                href={`/activity/${c.slug}`}
                className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Trip length ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <h2 className="text-2xl font-bold md:text-3xl">Browse by trip length</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/day-trips"
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className="text-3xl">🕗</span>
            <span>
              <span className="block font-display text-lg font-bold text-slate-900">
                1 Day Trips
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">
                Back the same day — half-day escapes and full-day adventures
              </span>
            </span>
          </Link>
          <Link
            href="/multi-day-trips"
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className="text-3xl">🧳</span>
            <span>
              <span className="block font-display text-lg font-bold text-slate-900">
                Multi-day Trips
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">
                24 hours or longer — island hops and overnight journeys
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- 1 Day trips ---------- */}
      <TourSection
        title="1 Day Trips"
        blurb="Half-day escapes and full-day adventures — back at your hotel by evening."
        href="/day-trips"
        tours={dayTours}
        priority
      />

      {/* ---------- Promotional banner ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="space-y-4">
          {bannerItems.map((b) => (
            <Link
              key={b.id}
              href={b.href}
              className="group relative block min-h-[200px] overflow-hidden rounded-3xl md:min-h-[240px]"
            >
              <SmartImage
                src={b.image || "/media/hero-uluwatu-sunset.webp"}
                alt=""
                fill
                sizes="100vw"
                className="transition-transform duration-500 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/80 to-brand-900/30"
                aria-hidden
              />
              <span className="relative flex min-h-[200px] flex-col justify-center gap-3 p-8 md:min-h-[240px] md:p-12">
                <span className="inline-flex w-fit rounded-full bg-sunset-500 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
                  {b.pill}
                </span>
                <span className="max-w-xl font-display text-2xl font-bold text-white md:text-4xl">
                  {b.title}
                </span>
                {b.subtitle && (
                  <span className="max-w-lg text-sm text-brand-100 md:text-base">{b.subtitle}</span>
                )}
                <span className="mt-1 w-fit rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-800 transition-colors group-hover:bg-brand-50">
                  View details →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Multi-day trips ---------- */}
      <TourSection
        title="Multi-day Trips"
        blurb="24 hours or longer — island hops, sunrise treks and overnight journeys across Bali."
        href="/multi-day-trips"
        tours={multidayTours}
      />

      {/* ---------- Destinations ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold md:text-3xl">Popular destinations</h2>
        <DestinationGrid destinations={destinationTiles} />
      </section>

      {/* ---------- Why book with us ---------- */}
      <section className="bg-brand-900 py-14 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-2xl font-bold md:text-3xl">Why book with us</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <div className="text-3xl">{w.emoji}</div>
                <h3 className="mt-3 font-sans text-base font-bold text-white">{w.title}</h3>
                <p className="mt-1 text-sm text-brand-200">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="text-2xl font-bold md:text-3xl">What travelers say</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {(testimonials.length
            ? testimonials
            : [
                {
                  id: "demo1",
                  rating: 5,
                  title: "Amazing ATV ride!",
                  body: "Best experience of our Bali trip. The guide was funny and the jungle track was incredible.",
                  customer: { name: "Sarah" },
                  product: { name: "Ubud ATV Adventure", slug: "ubud-atv-adventure" },
                  createdAt: new Date(),
                },
                {
                  id: "demo2",
                  rating: 5,
                  title: "Nusa Penida day trip",
                  body: "Kelingking beach is unreal. Booking took 2 minutes and everything was confirmed instantly.",
                  customer: { name: "Tom" },
                  product: { name: "Nusa Penida West Tour", slug: "nusa-penida-west" },
                  createdAt: new Date(),
                },
                {
                  id: "demo3",
                  rating: 4,
                  title: "Telaga Waja rafting",
                  body: "Great rapids and beautiful scenery. Pickup from our hotel right on time.",
                  customer: { name: "Emma" },
                  product: { name: "Telaga Waja River Rafting", slug: "telaga-waja-rafting" },
                  createdAt: new Date(),
                },
              ]
          ).map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Stars rating={r.rating} size="md" />
              <p className="mt-2 font-semibold text-slate-900">{r.title || r.product?.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">&ldquo;{r.body}&rdquo;</p>
              <p className="mt-3 text-xs font-semibold text-slate-400">
                {r.customer?.name} · {r.product?.name}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Travel guides ---------- */}
      {posts.length > 0 && (
        <section className="bg-sand-50 py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-bold md:text-3xl">Bali travel guides</h2>
              <ButtonLink href="/blog" variant="ghost" size="sm">
                All guides →
              </ButtonLink>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md"
                >
                  <div className="relative aspect-video bg-slate-100">
                    <SmartImage
                      src={p.featuredImage}
                      alt={p.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-sunset-500">
                      {p.category || "Travel guide"}
                    </p>
                    <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold group-hover:text-brand-700">
                      {p.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {p.excerpt || mdToText(p.content, 140)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- FAQ ---------- */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
          <div className="mt-6 space-y-3">
            {faqs.map((f) => (
              <details key={f.id} className="group rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer font-semibold text-slate-800 marker:text-brand-600">
                  {f.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
