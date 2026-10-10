import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SearchBox } from "@/components/SearchBox";
import { TourCard } from "@/components/TourCard";
import { Stars, SmartImage, ButtonLink } from "@/components/ui";
import { popularProducts } from "@/lib/search";
import { mdToText } from "@/lib/md";

export const revalidate = 300; // ISR: homepage refreshes every 5 minutes

const CATEGORIES = [
  { name: "Adventure", slug: "adventure", emoji: "🪂" },
  { name: "ATV", slug: "atv", emoji: "🏍️" },
  { name: "Rafting", slug: "rafting", emoji: "🛶" },
  { name: "Water Sports", slug: "water-sports", emoji: "🌊" },
  { name: "Ubud Tours", slug: "ubud", emoji: "🎑" },
  { name: "Nusa Penida", slug: "nusa-penida", emoji: "🏝️" },
  { name: "Cultural Tours", slug: "cultural", emoji: "🛕" },
  { name: "Temple Tours", slug: "temple", emoji: "⛩️" },
  { name: "Sunrise Tours", slug: "sunrise", emoji: "🌄" },
  { name: "Private Tours", slug: "private", emoji: "🚗" },
];

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

export default async function HomePage() {
  const [tours, destinations, categories, testimonials, posts, faqs, stats] =
    await Promise.all([
      popularProducts(8),
      prisma.destination.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, take: 8 }),
      prisma.category.findMany({ where: { active: true, kind: "CATEGORY" }, orderBy: { sortOrder: "asc" }, take: 10 }),
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

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-brand-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 opacity-95" />
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-sunset-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
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
            <SearchBox />
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
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/activity/${c.slug}`}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-xs font-semibold text-slate-700">{c.name}</span>
            </Link>
          ))}
        </div>
        {categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((c) => (
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

      {/* ---------- Popular tours ---------- */}
      <section className="bg-sand-50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Popular tours & activities</h2>
              <p className="mt-1 text-slate-500">Top-rated experiences travelers love right now</p>
            </div>
            <ButtonLink href="/search" variant="outline" size="sm">
              View all →
            </ButtonLink>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tours.map((t, i) => (
              <TourCard key={t.id} tour={t} priority={i < 4} />
            ))}
          </div>
          {tours.length === 0 && (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Tours are being loaded — run <code>npm run db:seed</code> to populate demo content.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Destinations ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold md:text-3xl">Popular destinations</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(destinations.length ? destinations : DESTINATIONS).map((d) => (
            <Link
              key={"id" in d ? (d as { id: string }).id : (d as { slug: string }).slug}
              href={`/destination/${d.slug}`}
              className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-brand-800 p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              {"heroImage" in d && (d as { heroImage?: string }).heroImage && (
                <SmartImage
                  src={(d as { heroImage?: string }).heroImage}
                  alt={d.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="transition-transform duration-500 group-hover:scale-110"
                />
              )}
              <span className="relative font-display text-lg font-bold text-white">
                {"emoji" in d ? `${(d as { emoji: string }).emoji} ` : ""}
                {d.name}
              </span>
            </Link>
          ))}
        </div>
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
