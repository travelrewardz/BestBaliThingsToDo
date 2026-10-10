/**
 * Development / demo seed.
 * Run: npm run db:seed   (also runs automatically on `prisma migrate reset`)
 *
 * Demo credentials (development only):
 *   Admin     admin@balithingstodo.net  / Admin123!
 *   Supplier  wayan@wayantours.co.id    / Supplier123!   (ACTIVE, 15% commission)
 *   Supplier  made@madeadventures.id    / Supplier123!   (ACTIVE, 12% commission)
 *   Supplier  ketut@ketutexplorers.id   / Supplier123!   (PENDING application)
 *   Supplier  nyoman@nyomanjourneys.id  / Supplier123!   (SUSPENDED)
 *   Customer  customer@example.com      / Customer123!
 */
import type { Prisma } from "@prisma/client";
import { loadEnv } from "../src/lib/env-loader";

loadEnv();

type V = Record<string, unknown>;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261007);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = await import("bcryptjs");
  const prisma = new PrismaClient();

  console.log("⏳ Seeding database…");
  const t0 = Date.now();

  // ----------------------------------------------------------
  // Wipe in FK-safe order (development database only)
  // ----------------------------------------------------------
  const models = [
    "payoutItem", "commission", "payout", "refund", "payment",
    "supportMessage", "supportTicket", "review", "favorite",
    "bookingItem", "booking", "notification", "emailOutbox",
    "passwordReset", "session",
    "availabilityDay", "availabilityOverride", "availabilityRule", "priceRule",
    "productOption", "productMedia", "product", "supplierDocument", "supplier",
    "blogPost", "page", "faq", "seoMeta", "seoSetting",
    "landingPage", "banner", "menu", "setting", "translation", "auditLog",
    "media", "analyticsEvent",
    "rolePermission", "user", "role", "permission",
    "category", "destination",
  ] as const;
  await prisma.$transaction(
    models.map((m) =>
      (prisma[m] as { deleteMany: (a?: V) => Prisma.PrismaPromise<{ count: number }> }).deleteMany()
    )
  );

  // ----------------------------------------------------------
  // Roles & permissions (RBAC)
  // ----------------------------------------------------------
  const { PERMISSIONS, ROLE_PERMISSIONS } = await import("../src/lib/permissions");
  const permRows: V[] = [];
  for (const p of PERMISSIONS) {
    permRows.push(
      await prisma.permission.upsert({
        where: { code: p.code },
        create: { code: p.code, label: p.label },
        update: { label: p.label },
      })
    );
  }
  const permIdByCode = new Map(permRows.map((p) => [(p as V).code as string, (p as V).id as string]));
  // Wildcard permission used by the super-admin role
  const wildcard = await prisma.permission.upsert({
    where: { code: "*" },
    create: { code: "*", label: "Full access to everything" },
    update: {},
  });
  permIdByCode.set("*", wildcard.id);

  const roleIds: Record<string, string> = {};
  for (const [name, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: {
        name,
        label: name === "admin" ? "Super Admin" : name === "supplier" ? "Supplier" : "Customer",
        description:
          name === "admin"
            ? "Platform owner with full access"
            : name === "supplier"
              ? "Tour provider managing own products & bookings"
              : "Traveler who books tours",
      },
      update: {},
    });
    roleIds[name] = role.id;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes.map((code) => ({ roleId: role.id, permissionId: permIdByCode.get(code)! })),
    });
  }

  // ----------------------------------------------------------
  // Settings
  // ----------------------------------------------------------
  const { DEFAULT_SETTINGS } = await import("../src/lib/settings");
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }

  // ----------------------------------------------------------
  // Users
  // ----------------------------------------------------------
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@balithingstodo.net",
      passwordHash: await hash("Admin123!"),
      name: "Platform Admin",
      role: "ADMIN",
      roleId: roleIds.admin,
      phone: "+62811000001",
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
    },
  });

  type SupSeed = {
    email: string; name: string; company: string; slug: string; status: string;
    commission: number | null; city: string; phone: string; desc: string;
  };
  const SUPPLIERS: SupSeed[] = [
    {
      email: "wayan@wayantours.co.id", name: "I Wayan Sudarma", company: "Wayan Tours Bali",
      slug: "wayan-tours-bali", status: "ACTIVE", commission: 1500, city: "Ubud",
      phone: "+628123450001",
      desc: "Family-run tour operator based in Ubud with 12 years of experience in adventure and cultural tours.",
    },
    {
      email: "made@madeadventures.id", name: "Made Wirata", company: "Made Adventures",
      slug: "made-adventures", status: "ACTIVE", commission: 1200, city: "Canggu",
      phone: "+628123450002",
      desc: "Water sports and rafting specialists covering Ayung, Telaga Waja and the south coast.",
    },
    {
      email: "ketut@ketutexplorers.id", name: "Ketut Arya", company: "Ketut Explorers",
      slug: "ketut-explorers", status: "PENDING", commission: null, city: "Denpasar",
      phone: "+628123450003",
      desc: "Newly applied provider offering sunrise treks and volcano cycling.",
    },
    {
      email: "nyoman@nyomanjourneys.id", name: "Nyoman Sudikka", company: "Nyoman Journeys",
      slug: "nyoman-journeys", status: "SUSPENDED", commission: 2000, city: "Kuta",
      phone: "+628123450004",
      desc: "Kuta-based operator specialising in private city tours (currently suspended pending document renewal).",
    },
  ];

  const suppliers = [];
  for (const s of SUPPLIERS) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash: await hash("Supplier123!"),
        name: s.name,
        role: "SUPPLIER",
        roleId: roleIds.supplier,
        phone: s.phone,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
      },
    });
    suppliers.push(
      await prisma.supplier.create({
        data: {
          userId: user.id,
          companyName: s.company,
          slug: s.slug,
          description: s.desc,
          logoUrl: `/media/categories/${pick(["adventure", "atv", "rafting", "private"])}.webp`,
          address: `Jl. Raya ${s.city}`,
          city: s.city,
          email: s.email,
          phone: s.phone,
          whatsapp: s.phone.replace(/\s/g, ""),
          website: `https://${s.slug}.example.com`,
          status: s.status,
          commissionRateBps: s.commission,
          businessInfo: JSON.stringify({ registration: `PT-${s.slug.toUpperCase().slice(0, 8)}`, tax: "NPWP 000-000-000" }),
          bankInfo: JSON.stringify({ bank: "BCA", accountHolder: s.company, accountNumber: "1234567890" }),
          approvedAt: s.status === "ACTIVE" ? new Date(Date.now() - 86400000 * 120) : null,
          totalBookings: 0,
          totalRevenueCents: 0,
        },
      })
    );
  }
  const [wayan, made, ketut, nyoman] = suppliers;

  await prisma.supplierDocument.createMany({
    data: [
      { supplierId: wayan.id, type: "BUSINESS_LICENSE", fileName: "wayan-siup.pdf", fileUrl: "/uploads/docs/wayan-siup.pdf", status: "VERIFIED" },
      { supplierId: wayan.id, type: "BANK_PROOF", fileName: "wayan-bank.pdf", fileUrl: "/uploads/docs/wayan-bank.pdf", status: "VERIFIED" },
      { supplierId: made.id, type: "BUSINESS_LICENSE", fileName: "made-siup.pdf", fileUrl: "/uploads/docs/made-siup.pdf", status: "VERIFIED" },
      { supplierId: ketut.id, type: "BUSINESS_LICENSE", fileName: "ketut-siup.pdf", fileUrl: "/uploads/docs/ketut-siup.pdf", status: "PENDING" },
      { supplierId: nyoman.id, type: "BUSINESS_LICENSE", fileName: "nyoman-siup.pdf", fileUrl: "/uploads/docs/nyoman-siup.pdf", status: "REJECTED", note: "Document expired" },
    ],
  });

  const customerSeeds = [
    ["customer@example.com", "Sarah Mitchell", "Customer123!"],
    ["tom.becker@example.com", "Tom Becker", "Customer123!"],
    ["emma.laurent@example.com", "Emma Laurent", "Customer123!"],
    ["hiro.tanaka@example.com", "Hiro Tanaka", "Customer123!"],
    ["anna.kowalski@example.com", "Anna Kowalski", "Customer123!"],
    ["liam.oconnell@example.com", "Liam O'Connell", "Customer123!"],
  ] as const;
  const customers = [];
  for (const [email, name, pw] of customerSeeds) {
    customers.push(
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hash(pw),
          name,
          role: "CUSTOMER",
          roleId: roleIds.customer,
          emailVerifiedAt: new Date(),
          status: "ACTIVE",
        },
      })
    );
  }

  // ----------------------------------------------------------
  // Catalog: destinations, categories
  // ----------------------------------------------------------
  const DESTINATIONS = [
    ["ubud", "Ubud", "Bali's cultural heart", "Terraced rice fields, sacred temples and jungle adventures — Ubud is where Bali's soul lives."],
    ["canggu", "Canggu", "Surf & cafe capital", "Black-sand beaches, world-class surf breaks and a buzzing cafe scene make Canggu a favorite base."],
    ["seminyak", "Seminyak", "Stylish beach resort", "Upscale beach clubs, sunset bars and long golden beaches define stylish Seminyak."],
    ["kuta", "Kuta", "Original beach town", "Kuta is where Bali's tourism began — buzzing, affordable and great for water sports."],
    ["uluwatu", "Uluwatu", "Cliffs & temples", "Dramatic limestone cliffs, iconic temple sunsets and legendary surf at Uluwatu."],
    ["nusa-penida", "Nusa Penida", "Island of giants", "Kelingking's T-Rex cliff, Angel's Billabong and manta rays — Penida is raw and spectacular."],
    ["kintamani", "Kintamani", "Volcano highlands", "Cool highland air, Lake Batur views and authentic mountain villages at Kintamani."],
    ["mount-batur", "Mount Batur", "Sunrise trekking", "A pre-dawn climb to 1,717 m rewards you with sunrise over Mount Agung and the caldera."],
  ] as const;
  const destinations: Record<string, { id: string }> = {};
  let dSort = 0;
  for (const [slug, name, region, intro] of DESTINATIONS) {
    destinations[slug] = await prisma.destination.create({
      data: {
        name, slug, region,
        description: intro,
        intro: `## Discover ${name}\n\n${intro}\n\nFrom ${name} you can reach some of Bali's most loved experiences — sunrise treks, white-water rafting, ATV tracks through the jungle and temples that glow at golden hour. Everything below is bookable online with instant confirmation and free cancellation on most tours.`,
        heroImage: `/media/destinations/${slug}.webp`,
        image: `/media/destinations/${slug}.webp`,
        sortOrder: dSort++,
      },
    });
  }

  const CATEGORIES = [
    ["adventure", "Adventure", "CATEGORY", "Adrenaline-pumping experiences across Bali"],
    ["atv", "ATV", "ACTIVITY", "Quad biking through jungle, river and rice fields"],
    ["rafting", "Rafting", "ACTIVITY", "White-water rafting on Bali's wildest rivers"],
    ["water-sports", "Water Sports", "ACTIVITY", "Snorkeling, diving and ocean adventures"],
    ["cultural", "Cultural Tours", "CATEGORY", "Temples, dances and Balinese traditions"],
    ["temple", "Temple Tours", "ACTIVITY", "Sacred sites and spiritual journeys"],
    ["sunrise", "Sunrise Tours", "ACTIVITY", "Early climbs and golden-hour magic"],
    ["cycling", "Cycling", "ACTIVITY", "Downhill rides through villages and rice fields"],
    ["trekking", "Trekking", "ACTIVITY", "Volcano and jungle trails"],
    ["private", "Private Tours", "CATEGORY", "Your group, your schedule, your guide"],
    ["family", "Family Friendly", "CATEGORY", "Fun for travelers of every age"],
    ["nusa-penida", "Nusa Penida", "CATEGORY", "Island day trips and snorkel safaris"],
  ] as const;
  const categories: Record<string, { id: string }> = {};
  let cSort = 0;
  for (const [slug, name, kind, desc] of CATEGORIES) {
    categories[slug] = await prisma.category.create({
      data: {
        name, slug, kind: kind as string, description: desc,
        intro: `${desc}. Browse ${name.toLowerCase()} experiences in Bali — compare prices, read verified reviews and book online with instant confirmation.`,
        image: `/media/categories/${slug}.webp`,
        icon: "🌴",
        sortOrder: cSort++,
      },
    });
  }

  // ----------------------------------------------------------
  // Tours
  // ----------------------------------------------------------
  type TourSeed = {
    slug: string; name: string; supplier: number; destination: string; category: string;
    subtitle: string; intro: string; location: string; meeting: string;
    durationHours: number; durationLabel: string; type: "GROUP" | "PRIVATE";
    max: number; difficulty: string; adult: number; child: number; infant: number;
    weekendBps?: number; commissionBps?: number; status?: string;
    highlights: string[]; itinerary: { time: string; title: string; text: string }[];
    inclusions: string[]; exclusions: string[]; bring: string[];
    important: string; policy: string;
    options?: { name: string; startTime: string; extra?: number }[];
    faq: { q: string; a: string }[];
    rating?: number; ratingCount?: number; bookings?: number; views?: number;
    instant?: boolean; pickup?: string[]; languages?: string[];
  };

  const TOURS: TourSeed[] = [
    {
      slug: "ubud-atv-adventure", name: "Ubud ATV Adventure — Jungle, River & Mud Track",
      supplier: 0, destination: "ubud", category: "atv",
      subtitle: "Ride Bali's wildest quad tracks through jungle and rice fields",
      intro: "Rev your engine and plunge into the Bali countryside on a 90-minute ATV circuit built for fun, not fear. You'll carve through emerald rice paddies, splash across the Celuk river, duck under jungle canopy and finish with a cold towel and a tropical drink at our Ubud base. No experience needed — every rider gets a full safety briefing, helmet and a guide who rides with you.",
      location: "Ubud", meeting: "ATV Base Camp, Jl. Raya Taro, Tegallalang, Ubud",
      durationHours: 2.5, durationLabel: "Half day (2.5 hours)", type: "GROUP", max: 16,
      difficulty: "MODERATE", adult: 4500, child: 3000, infant: 0, weekendBps: 1000,
      highlights: [
        "90 minutes of riding through jungle, rice fields and river tracks",
        "Full safety gear, briefing and photo stops included",
        "Small groups max 16 riders with a lead and sweep guide",
        "Suitable for beginners — automatic quads, no license required",
      ],
      itinerary: [
        { time: "08:00", title: "Pickup & registration", text: "Hotel pickup in Ubud area or meet at the base camp, registration and safety briefing." },
        { time: "09:00", title: "Rice field loop", text: "Warm up on scenic tracks winding through Tegallalang rice terraces." },
        { time: "09:45", title: "River & jungle section", text: "The wild part: water crossings, muddy ruts and jungle single-track." },
        { time: "10:30", title: "Photo stop & refreshments", text: "Cool down at our waterfall viewpoint with fresh fruit and coffee." },
        { time: "11:00", title: "Return & shower", text: "Back at base camp — hot shower, towel and help arranging your return transfer." },
      ],
      inclusions: ["Hotel transfer in Ubud area", "ATV rental + fuel", "Helmet, boots & rain gear", "Experienced guide", "Tropical drink & towel", "Hot shower"],
      exclusions: ["Lunch (available to add on site)", "Tips & personal expenses", "Gratuities for guides"],
      bring: ["Clothes you don't mind getting muddy", "Change of clothes & sandals", "Sunscreen & insect repellent", "Camera in a waterproof case", "Cash for drinks"],
      important: "Minimum age 7 years (children ride as passengers with an adult). Riders must be sober — ATV riding under the influence is refused without refund. Pregnant guests and guests with back or neck injuries cannot ride.",
      policy: "Free cancellation up to 24 hours before the tour for a full refund. Changes made less than 24 hours before the start time are subject to availability. No-show is non-refundable.",
      options: [
        { name: "Morning ride", startTime: "09:00" },
        { name: "Afternoon ride", startTime: "14:00", extra: 500 },
      ],
      faq: [
        { q: "Do I need an ATV license?", a: "No. Our quads are automatic and easy to ride; you'll get a full training session before departure." },
        { q: "Can children join?", a: "Yes — from 7 years old as passengers with a participating adult." },
        { q: "What happens if it rains?", a: "Tours run in light rain — it makes the mud track even more fun. In rare cases of unsafe weather we reschedule or refund in full." },
      ],
      rating: 4.9, ratingCount: 128, bookings: 340, views: 5200,
      pickup: ["Ubud", "Tegallalang", "Canggu (extra)", "Sayan"],
      languages: ["English", "Indonesian"],
    },
    {
      slug: "telaga-waja-river-rafting", name: "Telaga Waja River Rafting — Class II–III Rapids",
      supplier: 1, destination: "mount-batur", category: "rafting",
      subtitle: "Bali's longest rafting river with jungle gorges and waterfalls",
      intro: "Telaga Waja is the river every Bali rafter comes home talking about: 12 kilometres of clean, fast-moving water cutting through a deep jungle gorge beneath Mount Agung. You'll run playful Class II–III rapids, drift past rice terraces clinging to the canyon walls and stop long enough to swim under a cascading waterfall before the final rapid launches you into the valley.",
      location: "Karangasem", meeting: "Telaga Waja Rafting Hub, Jl. Raya Putau, Karangasem",
      durationHours: 4, durationLabel: "Half day (4 hours)", type: "GROUP", max: 12,
      difficulty: "MODERATE", adult: 5500, child: 4000, infant: 0,
      highlights: [
        "12 km of white-water rafting on Bali's best river",
        "Class II–III rapids — exciting but beginner-friendly",
        "Waterfall swim stop inside a jungle gorge",
        "Riverside lunch included after the trip",
      ],
      itinerary: [
        { time: "08:30", title: "Transfer & gearing up", text: "Pickup from your hotel, arrive at the hub, safety briefing and equipment fitting." },
        { time: "09:30", title: "On the river", text: "Warm-up rapids while your guide points out wildlife and hidden temples." },
        { time: "10:30", title: "Waterfall stop", text: "Swim break under the jungle waterfall (optional, life jackets provided)." },
        { time: "11:15", title: "The big rapid", text: "The famous final rapid — hold on and scream!" },
        { time: "12:00", title: "Riverside lunch", text: "Shower, change and enjoy an Indonesian buffet lunch overlooking the river." },
      ],
      inclusions: ["Hotel transfer (selected zones)", "Rafting equipment & life jacket", "Certified river guide", "Riverside shower & changing room", "Buffet lunch", "Insurance on the river"],
      exclusions: ["Photos & video package", "Alcoholic drinks", "Tips"],
      bring: ["Swimwear & quick-dry clothes", "Change of clothes", "Waterproof sunscreen", "Sandals or river shoes", "Towel"],
      important: "Minimum age 7 years. Guests must be able to swim or wear a life jacket at all times. Not suitable for guests with heart conditions, epilepsy, or who are pregnant.",
      policy: "Free cancellation up to 48 hours before the tour. Full refund for cancellations due to river conditions declared unsafe by our guides.",
      faq: [
        { q: "Will I get wet?", a: "Absolutely — you're on a raft! Bring a change of clothes for after the trip." },
        { q: "Is it safe for beginners?", a: "Yes. Every trip has a certified guide per raft and life jackets are mandatory." },
      ],
      rating: 4.8, ratingCount: 96, bookings: 280, views: 4100,
      pickup: ["Ubud", "Karangasem", "Candidasa"],
      languages: ["English", "Indonesian", "German"],
    },
    {
      slug: "bali-water-sport-adventure", name: "Bali Water Sport Adventure — Tanjung Benoa",
      supplier: 1, destination: "kuta", category: "water-sports",
      subtitle: "Banana boat, flying fish, jet ski & snorkeling in one package",
      intro: "One ticket, four ocean thrills. Based at Tanjung Benoa — Bali's water sports capital — this half-day package bundles a banana boat ride, the outrageous flying fish, a jet ski spin and a guided reef snorkel. Instructors stay in the water with you the whole time, so first-timers and kids can join every activity safely.",
      location: "Tanjung Benoa, South Bali", meeting: "Benoa Water Sports Pier, Jl. Pratama, Tanjung Benoa",
      durationHours: 3, durationLabel: "3 hours", type: "GROUP", max: 20,
      difficulty: "EASY", adult: 6500, child: 5000, infant: 1500,
      highlights: [
        "4 activities: banana boat, flying fish, jet ski, snorkel",
        "All equipment and instructors included",
        "Beachfront changing rooms and showers",
        "Perfect family activity from age 5+",
      ],
      itinerary: [
        { time: "09:00", title: "Welcome & briefing", text: "Arrive at the pier, pick up your life jacket and meet your instructors." },
        { time: "09:30", title: "Banana boat", text: "15 minutes of bouncing across Benoa bay behind a speedboat." },
        { time: "10:00", title: "Flying fish", text: "The wildest ride on the water — hold on tight!" },
        { time: "10:45", title: "Jet ski", text: "10 minutes at the throttle with an instructor riding behind you." },
        { time: "11:15", title: "Snorkel reef", text: "Guided snorkel over the bay's coral garden with visible marine life." },
      ],
      inclusions: ["All 4 activities", "Life jacket & mask", "Instructor & insurance", "Shower & changing room", "Locker"],
      exclusions: ["Hotel transfer (available as add-on)", "Underwater camera", "Lunch"],
      bring: ["Swimwear", "Towel", "Waterproof sunscreen", "Dry change of clothes", "Cash for photos"],
      important: "Minimum age 5 years for banana boat and snorkeling; jet ski requires age 16+ to drive (passengers allowed from 6). Not suitable for pregnant guests.",
      policy: "Free cancellation up to 24 hours before the activity. Activities are weather dependent — full refund if the harbour master closes the bay.",
      faq: [
        { q: "Do I need to know how to swim?", a: "No — life jackets are provided for all activities and instructors stay in the water." },
        { q: "Can we do just one activity?", a: "Yes, single activities can be booked on site at the day rate." },
      ],
      rating: 4.6, ratingCount: 84, bookings: 410, views: 6300,
      languages: ["English", "Indonesian", "Chinese"],
    },
    {
      slug: "nusa-penida-west-tour", name: "Nusa Penida West Tour — Kelingking, Broken Beach & Angel's Billabong",
      supplier: 0, destination: "nusa-penida", category: "nusa-penida",
      subtitle: "The iconic T-Rex cliff, turquoise coves and natural infinity pool",
      intro: "One fast boat from Sanur, and Bali's most photographed coastline opens up in front of you. This full-day land tour covers the west of Penida in an air-conditioned vehicle with a local driver-guide: the T-Rex headland at Kelingking, the collapsed sinkhole of Broken Beach, the tidal pools of Angel's Billabong and a cliff-top lunch over Crystal Bay.",
      location: "Nusa Penida", meeting: "Sanur Harbour fast boat pier (or your selected hotel pickup)",
      durationHours: 9, durationLabel: "Full day (9 hours)", type: "GROUP", max: 14,
      difficulty: "MODERATE", adult: 12500, child: 9500, infant: 4500,
      highlights: [
        "Round-trip fast boat Sanur ⇄ Nusa Penida",
        "Kelingking Beach viewpoint — the T-Rex cliff",
        "Broken Beach & Angel's Billabong",
        "Air-conditioned private vehicle with local guide",
      ],
      itinerary: [
        { time: "06:30", title: "Hotel pickup", text: "Pickup from selected South Bali / Ubud zones and transfer to Sanur Harbour." },
        { time: "08:00", title: "Fast boat to Penida", text: "45-minute crossing with sweeping views of Bali's east coast." },
        { time: "10:00", title: "Kelingking Beach", text: "Photo time at the T-Rex viewpoint; optional 30-minute descent to the beach." },
        { time: "12:00", title: "Clifftop lunch", text: "Seafood lunch overlooking Crystal Bay (own expense)." },
        { time: "13:00", title: "Broken Beach & Angel's Billabong", text: "Sinkhole arch and natural tide pools — swimming when conditions allow." },
        { time: "16:00", title: "Return boat", text: "Ferry back to Sanur and transfer to your hotel." },
      ],
      inclusions: ["Round-trip fast boat", "Hotel transfers (selected zones)", "Air-conditioned vehicle + local guide", "Entrance tickets", "Mineral water", "Parking & tolls"],
      exclusions: ["Lunch", "Personal expenses", "Tips"],
      bring: ["Sunscreen & hat", "Comfortable walking shoes", "Swimwear & towel", "Cash for lunch & entrance upgrades", "Motion-sickness tablet if sensitive"],
      important: "Boats are weather dependent. The Kelingking beach descent is steep and unshaded — wear proper shoes and bring water. Angel's Billabong is dangerous at high tide; follow your guide's instructions.",
      policy: "Free cancellation up to 48 hours before departure. Boat cancellations by the operator receive a 100% refund or free reschedule.",
      faq: [
        { q: "Is the boat safe?", a: "Yes — we only work with licensed operators, life jackets are on board and trips are cancelled in unsafe swell." },
        { q: "Can we stay overnight instead?", a: "Yes — message us for a 2-day Penida package with accommodation." },
      ],
      rating: 4.7, ratingCount: 112, bookings: 520, views: 7800,
      pickup: ["Kuta", "Seminyak", "Canggu", "Sanur", "Ubud"],
      languages: ["English", "Indonesian", "Spanish"],
    },
    {
      slug: "mount-batur-sunrise-trek", name: "Mount Batur Sunrise Trek — 1,717m Volcano Hike",
      supplier: 2, destination: "mount-batur", category: "sunrise",
      subtitle: "Climb in the dark, watch the sun rise over Mount Agung",
      intro: "A 2 a.m. pickup feels insane until the moment the sky turns gold over Mount Agung and Lake Batur steams below you. This guided sunrise trek climbs 1,717 metres of active volcano in about two hours, with a simple but unforgettable breakfast of eggs cooked in volcanic steam at the summit. Certified local guides, torches, breakfast and transfers included.",
      location: "Kintamani", meeting: "Toya Bungkah Lake trailhead, Mount Batur",
      durationHours: 7, durationLabel: "7 hours (incl. transfers)", type: "GROUP", max: 12,
      difficulty: "CHALLENGING", adult: 5000, child: 4000, infant: 0,
      highlights: [
        "Summit sunrise at 1,717 m with views of Agung, Rinjani & Lake Batur",
        "Volcanic-steam breakfast at the crater",
        "Certified local mountain guide & torch included",
        "Swim in the hot springs after the trek (optional)",
      ],
      itinerary: [
        { time: "02:00", title: "Hotel pickup", text: "Early pickup from Ubud / South Bali and drive to the trailhead." },
        { time: "03:30", title: "Start climbing", text: "Two-hour hike by torchlight on a well-marked trail." },
        { time: "05:15", title: "Summit sunrise", text: "Watch first light spill across Bali, Lombok and the caldera." },
        { time: "06:00", title: "Volcanic breakfast", text: "Boiled eggs, bananas, coffee and toast steamed by the crater vents." },
        { time: "07:00", title: "Descend & hot springs", text: "Easy descent, optional stop at Toya Bungkah hot springs." },
        { time: "10:00", title: "Back at hotel", text: "Return transfer with your certificate photo." },
      ],
      inclusions: ["Hotel transfers", "Licensed guide & torch", "Entrance fee", "Volcanic breakfast & hot drinks", "Travel insurance on the trek"],
      exclusions: ["Hot springs entry ticket", "Tips", "Additional drinks"],
      bring: ["Warm jacket & long trousers", "Hiking shoes with grip", "Small daypack", "Camera & power bank", "Personal medication"],
      important: "This is a moderate-to-strenuous climb over loose volcanic gravel. Minimum age 10 years. Guests with asthma, heart conditions or severe knee problems should consult a doctor first.",
      policy: "Free cancellation up to 72 hours before the trek. Full refund if the trail is closed by the national park authorities.",
      faq: [
        { q: "How cold is it at the top?", a: "Around 10–12°C before sunrise — much colder than the beach. Bring a jacket." },
        { q: "Can beginners do it?", a: "Yes, if you can walk for 2 hours continuously at a moderate pace." },
      ],
      rating: 4.9, ratingCount: 143, bookings: 380, views: 6900,
      pickup: ["Ubud", "Kintamani", "Seminyak", "Canggu"],
      languages: ["English", "Indonesian"],
    },
    {
      slug: "ubud-cultural-day-tour", name: "Ubud Cultural Day Tour — Temples, Palace & Dance",
      supplier: 0, destination: "ubud", category: "cultural",
      subtitle: "Sacred monkey forest, royal palace and a Kecak fire dance finale",
      intro: "A perfectly paced day through old Ubud: the tangle of the Sacred Monkey Forest, the gold-leafed courtyards of Ubud Royal Palace, the silversmith village of Celuk and Tegenangan waterfall — ending with front-row seats at a traditional Kecak dance as the sun drops behind the stage.",
      location: "Ubud", meeting: "Hotel lobby or Ubud Royal Palace main gate",
      durationHours: 8, durationLabel: "Full day (8 hours)", type: "PRIVATE", max: 8,
      difficulty: "EASY", adult: 6500, child: 4500, infant: 2500,
      highlights: [
        "Private air-conditioned car with English-speaking guide",
        "Sacred Monkey Forest & Ubud Royal Palace",
        "Celuk silver workshop and Tegenangan waterfall",
        "Kecak fire dance ticket included",
      ],
      itinerary: [
        { time: "09:00", title: "Monkey Forest", text: "Walk the mossy lanes of the sacred forest with 1,200 long-tailed macaques." },
        { time: "11:00", title: "Royal Palace & art market", text: "Courtyards of the Ubud palace, then browsing the handicraft market." },
        { time: "12:30", title: "Lunch", text: "Balinese lunch at a riverside warung (own expense)." },
        { time: "14:00", title: "Celuk & Tegenangan", text: "Silversmith village workshop and a jungle waterfall swim stop." },
        { time: "17:00", title: "Kecak dance", text: "100-voice Kecak chorus against the sunset — the perfect finish." },
      ],
      inclusions: ["Private car with fuel & driver", "English-speaking guide", "All entrance tickets", "Kecak dance ticket", "Mineral water & parking"],
      exclusions: ["Meals", "Monkey forest banana feed (optional)", "Tips"],
      bring: ["Sarong for temple entries", "Comfortable shoes", "Swimwear for waterfall", "Cash", "Camera"],
      important: "Sarongs are provided at temples. Keep belongings secure in the monkey forest — monkeys snatch glasses and phones. Cameras are not allowed during the Kecak performance.",
      policy: "Free cancellation up to 24 hours before the tour.",
      faq: [
        { q: "Are the monkeys dangerous?", a: "They're wild but generally calm — follow your guide's instructions and don't carry food." },
        { q: "Is this good for elderly travelers?", a: "Yes — mostly short walks, and the private car waits for you at each stop." },
      ],
      rating: 4.8, ratingCount: 76, bookings: 190, views: 3400,
      pickup: ["Ubud", "Tegallalang", "Sayan"],
      languages: ["English", "Indonesian", "French"],
    },
    {
      slug: "bali-swings-and-terraces", name: "Bali Swing & Rice Terrace Adventure",
      supplier: 0, destination: "ubud", category: "adventure",
      subtitle: "Giant jungle swings above the Ayung river valley",
      intro: "The photo you've seen a thousand times is real, and this is where it's taken. Your driver collects you in Ubud for a morning of giant jungle swings over the Ayung valley, the Tegallalang rice terraces at their greenest, and a coconut at a cliff-edge cafe — with time to swim in the Tegenangan waterfall before heading back.",
      location: "Ubud", meeting: "Hotel lobby pickup",
      durationHours: 6, durationLabel: "6 hours", type: "PRIVATE", max: 6,
      difficulty: "EASY", adult: 7500, child: 5500, infant: 2000,
      highlights: [
        "Bali Swing ticket — 3 different swings & nest photo spots",
        "Tegallalang rice terrace walk",
        "Tegenangan waterfall swim",
        "Instagram-ready private car with driver",
      ],
      itinerary: [
        { time: "09:00", title: "Tegallalang terraces", text: "Early light on the famous cascading rice fields before the crowds." },
        { time: "10:30", title: "Bali Swing", text: "Swing over the jungle valley, bird nests and bunga nests included." },
        { time: "12:30", title: "Cliff cafe lunch", text: "Lunch with valley views (own expense)." },
        { time: "14:00", title: "Waterfall swim", text: "Cool off under Tegenangan waterfall before heading home." },
      ],
      inclusions: ["Private car & driver", "Bali Swing entrance ticket", "Waterfall ticket", "Mineral water", "Parking"],
      exclusions: ["Meals", "Professional photographer", "Tips"],
      bring: ["Bright flowing dress or shirt for photos", "Swimwear & towel", "Cash", "Sunscreen & hat"],
      important: "Swings have a height/weight limit (min 100 cm, max 120 kg). Wear secure footwear for the terrace walk — paths can be slippery.",
      policy: "Free cancellation up to 24 hours before the tour. Swing tickets are non-refundable once redeemed on site.",
      faq: [
        { q: "Do I have to pay for photos?", a: "Self-photos are free; a professional photographer is an optional add-on." },
        { q: "Can young children join?", a: "Yes — swings have child seats and the terraces are stroller-unfriendly, so bring a carrier." },
      ],
      rating: 4.7, ratingCount: 64, bookings: 210, views: 3900,
      languages: ["English", "Indonesian"],
    },
    {
      slug: "white-water-rafting-ayung", name: "Ayung River Rafting — Ubud White Water",
      supplier: 1, destination: "ubud", category: "rafting",
      subtitle: "Class II rapids right next to Ubud with jungle gorges",
      intro: "The Ayung is Bali's most accessible white-water river — and it happens to run through some of the island's greenest scenery. Just 20 minutes from central Ubud, you'll paddle through ravines hung with vines, past carved rock faces and down a string of playful Class II rapids that end in a natural shower under a jungle waterfall.",
      location: "Ubud", meeting: "Ayung Rafting Centre, Payangan, Gianyar",
      durationHours: 3.5, durationLabel: "3.5 hours", type: "GROUP", max: 10,
      difficulty: "EASY", adult: 4500, child: 3500, infant: 0,
      highlights: [
        "Only 20 minutes from central Ubud",
        "Class II rapids — perfect first rafting trip",
        "Jungle waterfall stop inside the gorge",
        "Lunch overlooking the river available",
      ],
      itinerary: [
        { time: "09:00", title: "Briefing", text: "Paddle techniques, safety talk and equipment fitting." },
        { time: "10:00", title: "River run", text: "8 km of rapids and calm emerald pools through the gorge." },
        { time: "11:00", title: "Waterfall stop", text: "Swim stop under the cascade." },
        { time: "11:45", title: "Finish & shower", text: "Hot showers and optional riverside lunch." },
      ],
      inclusions: ["Equipment & life jacket", "Certified guide", "Locker & shower", "Insurance on the river", "Towel"],
      exclusions: ["Lunch", "Hotel transfer (add-on)", "Photos"],
      bring: ["Swimwear", "Change of clothes", "River sandals", "Waterproof sunscreen"],
      important: "Minimum age 5 years. Not suitable for pregnant guests or guests with back problems.",
      policy: "Free cancellation up to 24 hours before the tour.",
      faq: [
        { q: "How does it differ from Telaga Waja?", a: "Ayung is closer to Ubud, shorter and gentler; Telaga Waja is longer, faster and more technical." },
      ],
      rating: 4.6, ratingCount: 58, bookings: 240, views: 3600,
      pickup: ["Ubud", "Payangan"],
      languages: ["English", "Indonesian"],
    },
    {
      slug: "bali-snorkeling-manta-point", name: "Nusa Penida Manta Point Snorkel Safari",
      supplier: 1, destination: "nusa-penida", category: "water-sports",
      subtitle: "Swim with manta rays at Bali's cleaning stations",
      intro: "Penida's cold, nutrient-rich currents draw manta rays year-round — and Manta Point is where they hover at cleaning stations just below the surface. This snorkel safari combines three of the island's best sites: the mantas at Manta Point, the coral garden of Gamat Bay and the fish-named crystal water of Crystal Bay.",
      location: "Nusa Penida", meeting: "Sanur Harbour or Banjar Nyuh boat jetty",
      durationHours: 6, durationLabel: "6 hours", type: "GROUP", max: 10,
      difficulty: "MODERATE", adult: 9500, child: 7500, infant: 0,
      highlights: [
        "Manta ray sighting guarantee — free re-trip if none seen",
        "3 snorkel sites including Crystal Bay",
        "Float vests, guide and equipment included",
        "Underwater photos included",
      ],
      itinerary: [
        { time: "07:30", title: "Boat departure", text: "Speedboat from Sanur to Nusa Penida (45 min)." },
        { time: "09:00", title: "Manta Point", text: "Drift snorkel with mantas at the cleaning station." },
        { time: "10:30", title: "Gamat Bay", text: "Coral garden bursting with anthias and turtles." },
        { time: "12:00", title: "Crystal Bay", text: "Final snorkel in impossibly clear water, then return boat." },
      ],
      inclusions: ["Speedboat & fuel", "Snorkel set & float vest", "English guide", "Underwater photos", "Mineral water & fruit"],
      exclusions: ["Hotel transfer", "Lunch", "Marine park contribution (IDR 25,000)"],
      bring: ["Swimwear & rash guard", "Towel", "Motion-sickness tablet (take 30 min before)", "Biodegradable sunscreen", "Dry bag"],
      important: "You must be comfortable in open water; life vests are mandatory. Manta sightings are wild and cannot be guaranteed — if none appear we re-trip you free.",
      policy: "Free cancellation up to 48 hours before departure. Weather cancellation by the captain = full refund.",
      faq: [
        { q: "Are mantas dangerous?", a: "Manta rays are gentle filter feeders and completely harmless to swimmers." },
        { q: "Can kids snorkel here?", a: "From 8 years with a confident swimmer and a float vest." },
      ],
      rating: 4.9, ratingCount: 87, bookings: 300, views: 5100,
      languages: ["English", "Indonesian"],
    },
    {
      slug: "seminyak-private-city-tour", name: "Seminyak Private Highlights Tour",
      supplier: 3, destination: "seminyak", category: "private",
      subtitle: "Your group, your pace — beaches, temples and beach clubs",
      intro: "A private car and guide for the day, shaped around what you actually want to see. Temple hops in Tanah Lot, shopping in Seminyak's boutiques, sunset drinks at a beach club or a coffee stop in a hidden village — you set the pace, the driver knows every shortcut.",
      location: "Seminyak", meeting: "Your hotel lobby in Seminyak / Kerobokan",
      durationHours: 8, durationLabel: "Full day (8 hours)", type: "PRIVATE", max: 6,
      difficulty: "EASY", adult: 8500, child: 6500, infant: 3500,
      highlights: [
        "Fully private car & English-speaking driver",
        "Custom itinerary — change it on the day",
        "Tanah Lot temple sunset option",
        "Free flow mineral water & parking covered",
      ],
      itinerary: [
        { time: "10:00", title: "Hotel pickup", text: "Meet your driver in the lobby — itinerary confirmed on the spot." },
        { time: "11:00", title: "Tanah Lot temple", text: "Bali's most dramatic sea temple on its offshore rock." },
        { time: "14:00", title: "Seminyak boutiques", text: "Shopping and lunch stop (your choice of area)." },
        { time: "17:00", title: "Sunset beach club", text: "Drop at a beach club or return to your hotel." },
      ],
      inclusions: ["Private car & driver", "Fuel, parking & tolls", "Mineral water", "Petrol", "Phone holder & charger"],
      exclusions: ["Entrance tickets", "Meals & drinks", "Tips"],
      bring: ["Sarong for temples", "Sunscreen", "Cash for entries & shopping"],
      important: "Driver waits a maximum of 15 minutes past pickup time. Temple entrances (IDR 50–60k) are paid directly on site.",
      policy: "Free cancellation up to 24 hours before the tour.",
      faq: [
        { q: "Can we change the itinerary during the day?", a: "Yes — it's your private car; just tell your driver." },
      ],
      rating: 4.5, ratingCount: 32, bookings: 90, views: 1800,
      languages: ["English", "Indonesian"],
    },
    {
      slug: "uluwatu-temple-and-kecak", name: "Uluwatu Temple & Kecak Fire Dance at Sunset",
      supplier: 3, destination: "uluwatu", category: "cultural",
      subtitle: "Clifftop temple, mischievous monkeys and a sunset chant",
      intro: "Perched 70 metres above the Indian Ocean, Uluwatu is Bali's most cinematic temple — and its Kecak performance at sunset is pure theatre. We collect you in the afternoon, tour the cliff circuit of temples and finish with reserved seats for the 100-voice chant as the sun melts into the sea.",
      location: "Uluwatu", meeting: "Hotel lobby pickup (South Bali zone)",
      durationHours: 6, durationLabel: "6 hours", type: "GROUP", max: 14,
      difficulty: "EASY", adult: 5500, child: 4000, infant: 2000,
      highlights: [
        "Uluwatu Temple perched on a sea cliff",
        "Kecak fire dance with sunset backdrop",
        "Reserved seating section",
        "Hotel transfers from South Bali",
      ],
      itinerary: [
        { time: "14:00", title: "Hotel pickup", text: "Afternoon collection from Kuta / Seminyak / Jimbaran zone." },
        { time: "15:30", title: "Uluwatu temple", text: "Cliff-top circuit with your guide (sarong provided)." },
        { time: "17:00", title: "Kecak dance", text: "100-voice chant and fire dance against the sunset." },
        { time: "18:30", title: "Seafood dinner option", text: "Drop at Jimbaran seafood cafes or return to hotel." },
      ],
      inclusions: ["Hotel transfers (South Bali)", "Temple entrance ticket", "Kecak dance ticket", "English guide", "Sarong"],
      exclusions: ["Seafood dinner", "Tips"],
      bring: ["Sarong & sash (provided if needed)", "Secure bag for monkeys", "Camera", "Light jacket for after sunset"],
      important: "Uluwatu's macaques are bold — hold phones and sunglasses tightly and don't carry food. The cliff paths are exposed; wear closed shoes.",
      policy: "Free cancellation up to 24 hours before the tour.",
      faq: [
        { q: "Is the dance outdoors?", a: "Yes, an open-air amphitheatre — ponchos provided in the rain." },
      ],
      rating: 4.7, ratingCount: 54, bookings: 160, views: 2900,
      languages: ["English", "Indonesian", "Spanish"],
    },
    {
      slug: "kintamani-volcano-cycling", name: "Kintamani Downhill Volcano Cycling",
      supplier: 2, destination: "kintamani", category: "cycling",
      subtitle: "25 km of easy downhill from Mount Batur to Ubud",
      intro: "Start at 1,500 metres beside the steaming caldera of Mount Batur, then roll downhill for 25 kilometres through clove forests, bamboo groves and rice villages — all the way to Ubud. It's mostly gravity-assisted, so anyone who can ride a bike can do it, and the coffee stop halfway is legendary.",
      location: "Kintamani", meeting: "Mount Batur viewpoint parking, Kintamani",
      durationHours: 5, durationLabel: "5 hours", type: "GROUP", max: 12,
      difficulty: "EASY", adult: 6000, child: 4500, infant: 0,
      highlights: [
        "Downhill only — no pedfitness needed!",
        "Views over Lake Batur & the caldera at the start",
        "Village coffee & fruit stop",
        "Bike, helmet & support car included",
      ],
      itinerary: [
        { time: "08:00", title: "Transfer to summit", text: "Drive up to the Kintamani viewpoint for photos over the caldera." },
        { time: "09:00", title: "Downhill ride", text: "25 km of quiet back roads through villages and plantations." },
        { time: "10:30", title: "Coffee stop", text: "Local coffee, luwak tasting and tropical fruit." },
        { time: "11:30", title: "Finish in Ubud", text: "Support car at all times; finish near central Ubud." },
      ],
      inclusions: ["Mountain bike & helmet", "Support car", "Coffee & fruit stop", "English guide", "Insurance"],
      exclusions: ["Hotel transfer (add-on)", "Tips"],
      bring: ["Comfortable clothes", "Closed shoes", "Sunscreen & sunglasses", "Camera"],
      important: "Minimum age 12 years. Riders must be confident on two wheels — the route includes short downhill stretches on tarmac.",
      policy: "Free cancellation up to 24 hours before the tour.",
      faq: [
        { q: "How fit do I need to be?", a: "Able to ride a bike comfortably; the route is 90% downhill." },
      ],
      rating: 4.8, ratingCount: 47, bookings: 130, views: 2400,
      languages: ["English", "Indonesian"],
      status: "SUBMITTED", // pending product approval demo
    },
    {
      slug: "bali-cooking-class-ubud", name: "Balinese Cooking Class — Market Visit & 7 Dishes",
      supplier: 0, destination: "ubud", category: "cultural",
      subtitle: "Morning market tour, spice pastes and a feast you cooked yourself",
      intro: "Begin at the morning market choosing produce with your chef, then head to our open-air kitchen to grind spice pastes by hand and cook seven dishes — lawar, sate lilit, bebek betutu and more — before sitting down to eat everything you've made. Recipes go home with you.",
      location: "Ubud", meeting: "Paon Cooking Class, Jl. Hanoman, Ubud",
      durationHours: 5, durationLabel: "5 hours", type: "GROUP", max: 12,
      difficulty: "EASY", adult: 5000, child: 3500, infant: 1500,
      highlights: [
        "Guided morning market visit",
        "Cook 7 authentic Balinese dishes",
        "Recipe booklet to take home",
        "Vegetarian & vegan options",
      ],
      itinerary: [
        { time: "08:30", title: "Market tour", text: "Pick ingredients with your chef at Ubud morning market." },
        { time: "10:00", title: "Spice paste workshop", text: "Grind basé genep (Balinese spice mix) with a stone mortar." },
        { time: "11:00", title: "Cook the feast", text: "Seven dishes from satay to desserts." },
        { time: "12:30", title: "Eat together", text: "Sit down to the meal you cooked, with recipes emailed later." },
      ],
      inclusions: ["Market visit & transfers in Ubud", "All ingredients & apron", "7-dish lunch", "Recipe booklet", "Filtered water"],
      exclusions: ["Alcoholic drinks", "Tips"],
      bring: ["Closed-toe shoes", "Hair tie for long hair", "Appetite!"],
      important: "Please advise allergies at booking — most dishes can be adapted. Classes run with a minimum of 2 guests.",
      policy: "Free cancellation up to 24 hours before the class.",
      faq: [
        { q: "Is it vegetarian friendly?", a: "Yes — tell us at booking and we'll adapt the menu." },
      ],
      rating: 4.9, ratingCount: 68, bookings: 150, views: 2600,
      languages: ["English", "Indonesian"],
      status: "DRAFT",
    },
    {
      slug: "bali-zipline-adventure", name: "Bali Zipline & Canyoning Adventure",
      supplier: 1, destination: "ubud", category: "adventure",
      subtitle: "Six zip lines, two rappels and a canyon plunge",
      intro: "Clip in and fly: six zip lines spanning a jungle canyon, two rope descends into the gorge and a natural rock pool you can jump into. Our canyon team handles every anchor — you just enjoy the ride and the waterfall shower at the end.",
      location: "Ubud", meeting: "Sungai Adventure Base, Payangan",
      durationHours: 4, durationLabel: "4 hours", type: "GROUP", max: 10,
      difficulty: "MODERATE", adult: 8500, child: 6500, infant: 0,
      highlights: [
        "6 zip lines across a jungle canyon",
        "2 guided rappels into the gorge",
        "Canyon pool swim & waterfall",
        "All technical gear included",
      ],
      itinerary: [
        { time: "09:00", title: "Safety & gearing up", text: "Harness fitting, carabiner checks and technique briefing." },
        { time: "10:00", title: "Zip lines", text: "Six lines progressively deeper into the canyon." },
        { time: "11:30", title: "Rappels", text: "Descend 20 m into the gorge with your guide." },
        { time: "12:30", title: "Canyon swim", text: "Jump into the natural pool and shower under the falls." },
      ],
      inclusions: ["Technical gear & helmet", "Certified canyoning guide", "Shower & changing room", "Insurance", "Fruit & water"],
      exclusions: ["Lunch", "Photos", "Tips"],
      bring: ["Swimwear under clothes", "Sports shoes that can get wet", "Towel", "Change of clothes"],
      important: "Minimum age 10 years, minimum weight 25 kg. Not suitable for guests with heart conditions or fear of heights you can't talk yourself out of.",
      policy: "Free cancellation up to 48 hours before the tour.",
      faq: [
        { q: "Will I get completely wet?", a: "Yes — the canyon swim at the end is the highlight." },
      ],
      rating: 4.7, ratingCount: 41, bookings: 110, views: 2100,
      languages: ["English", "Indonesian"],
    },
    {
      slug: "tibumana-waterfall-tour", name: "Tibumana Waterfall & Hidden Temples",
      supplier: 0, destination: "ubud", category: "adventure",
      subtitle: "A quiet cascade, jungle pools and three hidden temples",
      intro: "Away from the tour-bus circuit, Tibumana falls plunges into an emerald pool perfect for swimming. The day combines the waterfall with two lesser-known temples and a bamboo-forest walk — a gentle, uncrowded taste of Bali's green interior.",
      location: "Bangli", meeting: "Tibumana Waterfall entrance, Bangli",
      durationHours: 5, durationLabel: "5 hours", type: "GROUP", max: 12,
      difficulty: "EASY", adult: 4500, child: 3000, infant: 1500,
      highlights: [
        "Swim in the emerald plunge pool",
        "Two hidden temples with almost no crowds",
        "Bamboo forest photo walk",
        "Local lunch beside the river",
      ],
      itinerary: [
        { time: "09:00", title: "Tibumana falls", text: "Short jungle walk to the cascade and swim." },
        { time: "11:00", title: "Hidden temples", text: "Two village temples rarely visited by tourists." },
        { time: "12:30", title: "Riverside lunch", text: "Home-cooked Balinese lunch (own expense)." },
      ],
      inclusions: ["Entrance tickets", "English guide", "Mineral water", "Towel"],
      exclusions: ["Lunch", "Hotel transfer", "Tips"],
      bring: ["Swimwear & towel", "Walking shoes", "Cash for lunch"],
      important: "Steps to the falls are steep and can be slippery — take your time and use the handrail.",
      policy: "Free cancellation up to 24 hours before the tour.",
      faq: [
        { q: "Is it crowded?", a: "Much quieter than Tegenungan — we arrive before the midday wave." },
      ],
      rating: 4.6, ratingCount: 29, bookings: 85, views: 1500,
      languages: ["English", "Indonesian"],
      status: "IN_REVIEW",
    },
    {
      slug: "bali-airport-transfer-private", name: "Private Airport Transfer — Denpasar (DPS)",
      supplier: 3, destination: "kuta", category: "private",
      subtitle: "Meet & greet, fixed price, flight tracking",
      intro: "Skip the taxi queue: your driver waits in arrivals with your name board, tracks your flight and takes you anywhere in South Bali or Ubud at a fixed price. Chilled water, phone chargers and child seats on request.",
      location: "Ngurah Rai International Airport", meeting: "Arrivals hall, Denpasar Airport (DPS)",
      durationHours: 1.5, durationLabel: "1–2 hours", type: "PRIVATE", max: 4,
      difficulty: "EASY", adult: 1800, child: 1800, infant: 1800,
      highlights: [
        "Fixed price — no meter, no surprises",
        "Flight tracking & free waiting time (60 min)",
        "Meet & greet with name board",
        "Air-conditioned private car",
      ],
      itinerary: [
        { time: "any", title: "Arrival", text: "Driver meets you at arrivals with a name board and helps with luggage." },
        { time: "any", title: "Direct transfer", text: "Private car straight to your hotel — no stops, no detours." },
      ],
      inclusions: ["Private air-conditioned car", "Driver & fuel", "60 min free waiting", "Bottled water", "Tolls & parking"],
      exclusions: ["Gratuities", "Extra stops (small fee)"],
      bring: ["Flight number at booking", "Hotel address in Bali"],
      important: "Return transfers to the airport can be added at checkout. Late-night surcharge (00:00–06:00) applies automatically at checkout.",
      policy: "Free cancellation up to 24 hours before pickup. Free flight-delay waiting up to 90 minutes.",
      faq: [
        { q: "What if my flight is delayed?", a: "We track your flight — waiting is free for up to 90 minutes after landing." },
      ],
      rating: 4.8, ratingCount: 96, bookings: 640, views: 8200,
      languages: ["English", "Indonesian"],
      status: "PUBLISHED",
    },
  ];

  const products = new Map<string, V>();
  let pSort = 0;
  for (const t of TOURS) {
    const supplier = suppliers[t.supplier];
    const status = t.status ?? "PUBLISHED";
    const media = [1, 2, 3].map((i) => ({
      url: `/media/tours/${t.slug}-${i}.webp`,
      alt: `${t.name} — Bali experience photo ${i}`,
      title: t.name,
      caption: i === 1 ? `${t.name}, Bali` : null,
      isPrimary: i === 1,
      sortOrder: i,
    }));
    const product = await prisma.product.create({
      data: {
        supplierId: supplier.id,
        slug: t.slug,
        name: t.name,
        shortTitle: t.subtitle,
        subtitle: t.subtitle,
        description: t.intro,
        categoryId: categories[t.category]?.id ?? null,
        destinationId: destinations[t.destination]?.id ?? null,
        location: t.location,
        meetingPoint: t.meeting,
        pickupInfo: `Free pickup from ${t.pickup?.join(", ") ?? "selected zones"}. Wait in your hotel lobby 10 minutes before the scheduled time.`,
        pickupLocations: JSON.stringify(t.pickup ?? ["Ubud", "Seminyak"]),
        durationHours: t.durationHours,
        durationLabel: t.durationLabel,
        languages: JSON.stringify(t.languages ?? ["English"]),
        tourType: t.type,
        minParticipants: 1,
        maxParticipants: t.max,
        ageRestriction: t.category === "atv" ? "7+ years" : null,
        difficulty: t.difficulty,
        instantConfirm: t.instant ?? true,
        freeCancellation: true,
        cancellationPolicy: t.policy,
        familyFriendly: t.difficulty !== "CHALLENGING",
        currency: "USD",
        priceAdultCents: t.adult * 100,
        priceChildCents: t.child * 100,
        priceInfantCents: t.infant * 100,
        privateGroupCents: t.type === "PRIVATE" ? t.adult * 100 : null,
        supplierCostCents: Math.round(t.adult * 100 * 0.7),
        commissionRateBps: t.commissionBps ?? null,
        weekendRateBps: t.weekendBps ?? 0,
        highlights: JSON.stringify(t.highlights),
        itinerary: JSON.stringify(t.itinerary),
        inclusions: JSON.stringify(t.inclusions),
        exclusions: JSON.stringify(t.exclusions),
        whatToBring: JSON.stringify(t.bring),
        importantInfo: t.important,
        terms: "By booking you agree to our terms & conditions. Guests must follow supplier safety instructions.",
        faq: JSON.stringify(t.faq),
        defaultCapacity: t.type === "PRIVATE" ? t.max : between(10, 24),
        bookingCutoffHours: t.slug.includes("sunrise") ? 24 : 12,
        maxAdvanceDays: 180,
        status,
        submittedAt: ["SUBMITTED", "IN_REVIEW", "APPROVED", "PUBLISHED"].includes(status) ? new Date(Date.now() - 86400000 * 10) : null,
        approvedAt: status === "PUBLISHED" ? new Date(Date.now() - 86400000 * 9) : null,
        publishedAt: status === "PUBLISHED" ? new Date(Date.now() - 86400000 * between(1, 60)) : null,
        viewCount: t.views ?? between(300, 2000),
        bookingCount: t.bookings ?? 0,
        ratingAvg: t.rating ?? 0,
        ratingCount: t.ratingCount ?? 0,
        createdAt: new Date(Date.now() - 86400000 * between(30, 400)),
      },
    });
    await prisma.productMedia.createMany({ data: media.map((m) => ({ ...m, productId: product.id })) });
    await prisma.availabilityRule.createMany({
      data: [
        { productId: product.id, weekday: null, capacity: product.defaultCapacity, active: true },
        { productId: product.id, weekday: 0, capacity: Math.max(4, Math.round(product.defaultCapacity * 0.6)), active: true },
        { productId: product.id, weekday: 6, capacity: Math.max(4, Math.round(product.defaultCapacity * 0.7)), active: true },
      ],
    });
    if (t.options) {
      await prisma.productOption.createMany({
        data: t.options.map((o, i) => ({
          productId: product.id,
          name: o.name,
          startTime: o.startTime,
          priceAdultCents: o.extra ? product.priceAdultCents + o.extra * 100 : null,
          sortOrder: i,
          active: true,
        })),
      });
    }
    // seasonal price rule demo
    const nextYear = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 6, 1));
    await prisma.priceRule.create({
      data: {
        productId: product.id,
        name: "High season surcharge",
        type: "SEASONAL",
        dateFrom: nextYear,
        dateTo: new Date(nextYear.getTime() + 30 * 86400000),
        surchargeBps: 1500,
        active: true,
      },
    });
    products.set(t.slug, product as unknown as V);
    pSort++;
  }
  void pSort;

  console.log(`  ✓ ${TOURS.length} tours`);

  // ----------------------------------------------------------
  // Bookings, payments, commissions, reviews
  // ----------------------------------------------------------
  const publishedTours = TOURS.filter((t) => (t.status ?? "PUBLISHED") === "PUBLISHED");
  const statusPool = [
    "PAID", "PAID", "CONFIRMED", "CONFIRMED", "CONFIRMED", "COMPLETED", "COMPLETED",
    "COMPLETED", "COMPLETED", "CANCELLED", "AWAITING_PAYMENT", "PENDING",
    "SUPPLIER_CONFIRMATION_REQUIRED", "REFUND_REQUESTED", "NO_SHOW", "PAID",
  ];
  const paidStatuses = ["PAID", "CONFIRMED", "COMPLETED", "NO_SHOW"];
  let refSeq = 1;
  const year = new Date().getUTCFullYear();

  for (let i = 0; i < 34; i++) {
    const tour = pick(publishedTours);
    const product = products.get(tour.slug)!;
    const supplier = suppliers[tour.supplier];
    const customer = pick(customers);
    const daysOffset = between(-70, 45);
    const tourDate = new Date(Date.now() + daysOffset * 86400000);
    tourDate.setUTCHours(0, 0, 0, 0);
    const adults = between(1, 4);
    const children = rand() > 0.6 ? between(1, 2) : 0;
    const infants = rand() > 0.85 ? 1 : 0;
    const totalTravelers = adults + children + infants;
    const unitAdult = tour.adult * 100;
    const unitChild = tour.child * 100;
    const unitInfant = tour.infant * 100;
    const subtotal = adults * unitAdult + children * unitChild + infants * unitInfant;
    const discount = rand() > 0.85 ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal - discount;
    const rate = supplier.commissionRateBps ?? 1500;
    const commission = Math.round((total * rate) / 10000);
    const status = statusPool[i % statusPool.length];
    const reference = `BTD-${year}-${String(refSeq++).padStart(6, "0")}`;
    const wasPaid = paidStatuses.includes(status) || status === "REFUND_REQUESTED";
    const created = new Date(Date.now() - Math.abs(daysOffset) * 86400000 - between(1, 5) * 3600000);

    const booking = await prisma.booking.create({
      data: {
        reference,
        customerId: customer.id,
        supplierId: supplier.id,
        productSlug: tour.slug,
        productName: tour.name,
        productImage: `/media/tours/${tour.slug}-1.webp`,
        status,
        tourDate,
        tourTime: tour.options?.[0]?.startTime ?? "09:00",
        pickupLocation: tour.pickup ? pick(tour.pickup) : null,
        specialRequests: rand() > 0.75 ? "Vegetarian meals please — anniversary trip 🎉" : null,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: `+62811${between(1000000, 9999999)}`,
        customerUserId: customer.id,
        adults, children, infants, totalTravelers,
        subtotalCents: subtotal,
        discountCents: discount,
        totalCents: total,
        currency: "USD",
        couponCode: discount > 0 ? "WELCOME10" : null,
        commissionRateBps: rate,
        commissionCents: commission,
        supplierEarningsCents: total - commission,
        voucherCode: `v${i}x${between(10000, 99999)}k`,
        cancelledAt: status === "CANCELLED" ? created : null,
        cancelReason: status === "CANCELLED" ? "Change of travel plans" : null,
        confirmedAt: wasPaid ? created : null,
        completedAt: status === "COMPLETED" ? tourDate : null,
        createdAt: created,
      },
    });

    await prisma.bookingItem.create({
      data: {
        bookingId: booking.id,
        productId: product.id as string,
        itemName: tour.name,
        itemSlug: tour.slug,
        date: tourDate,
        adults, children, infants,
        seats: totalTravelers,
        unitAdultCents: unitAdult,
        unitChildCents: unitChild,
        unitInfantCents: unitInfant,
        lineTotalCents: subtotal,
      },
    });

    if (wasPaid) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          provider: rand() > 0.4 ? "STRIPE" : "BANK_TRANSFER",
          status: "SUCCEEDED",
          amountCents: total,
          currency: "USD",
          externalId: `pi_demo_${between(100000, 999999)}`,
          paidAt: created,
        },
      });
      await prisma.commission.create({
        data: {
          bookingId: booking.id,
          supplierId: supplier.id,
          grossCents: total,
          rateBps: rate,
          platformCents: commission,
          supplierCents: total - commission,
          currency: "USD",
        },
      });
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: {
          totalBookings: { increment: 1 },
          totalRevenueCents: { increment: total },
        },
      });
    } else {
      await prisma.commission.create({
        data: {
          bookingId: booking.id,
          supplierId: supplier.id,
          grossCents: total,
          rateBps: rate,
          platformCents: commission,
          supplierCents: total - commission,
          currency: "USD",
        },
      });
    }

    if (status === "REFUND_REQUESTED") {
      await prisma.refund.create({
        data: { bookingId: booking.id, amountCents: total, reason: "Supplier cancelled", status: "REQUESTED" },
      });
    }

    // Reviews for completed bookings
    if (status === "COMPLETED" && rand() > 0.25) {
      const ratingOptions = [5, 5, 5, 4, 4, 3];
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          productId: product.id as string,
          customerId: customer.id,
          rating: pick(ratingOptions),
          title: pick(["Unforgettable!", "Amazing experience", "Highly recommended", "Great day out", "Would book again"]),
          body: pick([
            "Everything was perfectly organised — pickup on time, guide was friendly and the experience exceeded our expectations. Would definitely book again!",
            "A brilliant morning out. The team took great care of us and the photos came out beautifully. Highly recommend to anyone visiting Bali.",
            "Well organised and great value. The only small note is the pickup ran 10 minutes late, but the tour itself was fantastic.",
            "One of the highlights of our honeymoon. The guide knew all the best photo spots and made sure everyone was comfortable.",
          ]),
          serviceRating: between(4, 5),
          guideRating: between(4, 5),
          valueRating: between(4, 5),
          status: "APPROVED",
          createdAt: new Date(tourDate.getTime() + 86400000 * between(1, 5)),
        },
      });
    }
  }
  console.log("  ✓ 34 bookings + payments + commissions + reviews");

  // Keep the booking sequence ahead of the seeded references so new bookings
  // never collide with BTD-YYYY-NNNNNN values created above.
  await prisma.setting.upsert({
    where: { key: `seq_booking_${year}` },
    create: {
      key: `seq_booking_${year}`,
      value: String(refSeq - 1),
      group: "system",
      label: "Booking sequence",
      type: "number",
    },
    update: { value: String(refSeq - 1) },
  });

  // One pending review for moderation demo
  const completedNoReview = await prisma.booking.findFirst({
    where: { status: "COMPLETED", review: null },
    include: { items: true },
  });
  if (completedNoReview) {
    await prisma.review.create({
      data: {
        bookingId: completedNoReview.id,
        productId: completedNoReview.items[0].productId,
        customerId: completedNoReview.customerId,
        rating: 5,
        title: "Pending moderation demo",
        body: "Submitted moments ago — this review is waiting for admin approval in the moderation queue.",
        status: "PENDING",
      },
    });
  }

  // Availability demo: pre-fill a few upcoming days
  for (const t of publishedTours.slice(0, 6)) {
    const product = products.get(t.slug)!;
    for (let d = 1; d <= 10; d++) {
      const date = new Date(Date.now() + d * 86400000);
      date.setUTCHours(0, 0, 0, 0);
      const capacity = product.defaultCapacity as number;
      await prisma.availabilityDay.upsert({
        where: { productId_date: { productId: product.id as string, date } },
        create: { productId: product.id as string, date, capacity, booked: between(0, Math.max(1, capacity - 4)) },
        update: {},
      });
    }
  }

  // ----------------------------------------------------------
  // Payouts
  // ----------------------------------------------------------
  const wayanCommissions = await prisma.commission.findMany({
    where: { supplierId: wayan.id, payoutId: null, booking: { status: { in: paidStatuses } } },
    include: { booking: { select: { reference: true, productName: true } } },
    take: 6,
  });
  if (wayanCommissions.length >= 3) {
    const paidSet = wayanCommissions.slice(0, 3);
    const paidAmount = paidSet.reduce((s, c) => s + c.supplierCents, 0);
    const paidPayout = await prisma.payout.create({
      data: {
        supplierId: wayan.id,
        amountCents: paidAmount,
        status: "PAID",
        reference: "TRF-2026-0771",
        paidAt: new Date(Date.now() - 86400000 * 8),
        periodFrom: new Date(Date.now() - 86400000 * 38),
        periodTo: new Date(Date.now() - 86400000 * 8),
        createdAt: new Date(Date.now() - 86400000 * 7),
      },
    });
    await prisma.commission.updateMany({
      where: { id: { in: paidSet.map((c) => c.id) } },
      data: { payoutId: paidPayout.id },
    });
    await prisma.payoutItem.createMany({
      data: paidSet.map((c) => ({
        payoutId: paidPayout.id,
        bookingRef: c.booking.reference,
        productName: c.booking.productName,
        grossCents: c.grossCents,
        rateBps: c.rateBps,
        supplierCents: c.supplierCents,
      })),
    });
    const pendingSet = await prisma.commission.findMany({
      where: { supplierId: wayan.id, payoutId: null, booking: { status: { in: paidStatuses } } },
      take: 4,
    });
    if (pendingSet.length) {
      await prisma.payout.create({
        data: {
          supplierId: wayan.id,
          amountCents: pendingSet.reduce((s, c) => s + c.supplierCents, 0),
          status: "PENDING",
          periodFrom: new Date(Date.now() - 86400000 * 7),
          periodTo: new Date(),
          createdAt: new Date(),
        },
      });
    }
  }
  console.log("  ✓ payouts");

  // ----------------------------------------------------------
  // Coupons & promotions
  // ----------------------------------------------------------
  await prisma.coupon.createMany({
    data: [
      {
        code: "WELCOME10", description: "10% off your first booking",
        type: "PERCENT", value: 10, startDate: new Date(Date.now() - 86400000 * 30),
        endDate: new Date(Date.now() + 86400000 * 180), minBookingCents: 5000,
        maxDiscountCents: 3000, usageLimit: 1000, perUserLimit: 2, active: true,
      },
      {
        code: "BALI2026", description: "$15 off bookings over $120",
        type: "FIXED", value: 1500, startDate: new Date(Date.now() - 86400000 * 10),
        endDate: new Date(Date.now() + 86400000 * 60), minBookingCents: 12000,
        maxDiscountCents: null, usageLimit: 500, perUserLimit: 1, active: true,
      },
      {
        code: "EXPIRED5", description: "Expired demo coupon",
        type: "PERCENT", value: 5, startDate: new Date(Date.now() - 86400000 * 100),
        endDate: new Date(Date.now() - 86400000 * 10), usageLimit: 100, perUserLimit: 1, active: true,
      },
    ],
  });
  await prisma.promotion.createMany({
    data: [
      { name: "Early bird — 30 days ahead", type: "EARLY_BIRD", discountBps: 1000, leadDaysMin: 30, active: true },
      { name: "Last-minute — within 3 days", type: "LAST_MINUTE", discountBps: 700, leadDaysMax: 3, active: true },
      { name: "High season July", type: "SEASONAL", discountBps: 500, dateFrom: new Date(Date.UTC(new Date().getUTCFullYear(), 6, 1)), dateTo: new Date(Date.UTC(new Date().getUTCFullYear(), 6, 31)), active: false },
    ],
  });
  console.log("  ✓ coupons & promotions");

  // ----------------------------------------------------------
  // CMS: SEO settings, menus, banners, FAQs, pages, blog, landings
  // ----------------------------------------------------------
  await prisma.seoSetting.upsert({
    where: { key: "site" },
    create: {
      key: "site",
      siteTitle: "Bali Things To Do — Best Tours, Activities & Adventures",
      siteDescription:
        "Discover the best tours, activities, adventures and experiences in Bali. Book ATV rides, rafting, Nusa Penida trips and sunrise treks with trusted local suppliers.",
      defaultTitleSuffix: "| Bali Things To Do",
      defaultDescription:
        "Discover the best tours, activities, adventures and experiences in Bali. Book online with instant confirmation and free cancellation.",
      canonicalBase: "https://www.balithingstodo.net",
      ogImage: "/media/og-default.jpg",
      noindex: false,
    },
    update: {},
  });

  await prisma.menu.createMany({
    data: [
      { location: "HEADER", title: "Tours", url: "/search", sortOrder: 1 },
      { location: "HEADER", title: "ATV & Adventure", url: "/activity/adventure", sortOrder: 2 },
      { location: "HEADER", title: "Destinations", url: "/destination/ubud", sortOrder: 3 },
      { location: "HEADER", title: "Blog", url: "/blog", sortOrder: 4 },
      { location: "HEADER", title: "Contact", url: "/contact", sortOrder: 5 },
      { location: "FOOTER", title: "All tours", url: "/search", sortOrder: 1 },
      { location: "FOOTER", title: "ATV in Bali", url: "/bali-atv", sortOrder: 2 },
      { location: "FOOTER", title: "Rafting", url: "/bali-rafting", sortOrder: 3 },
      { location: "FOOTER", title: "Nusa Penida tours", url: "/nusa-penida-tours", sortOrder: 4 },
      { location: "FOOTER", title: "Ubud tours", url: "/ubud-tours", sortOrder: 5 },
      { location: "FOOTER", title: "About us", url: "/about", sortOrder: 6 },
      { location: "FOOTER", title: "Become a supplier", url: "/supplier/register", sortOrder: 7 },
    ],
  });

  await prisma.banner.createMany({
    data: [
      { title: "Monsoon sale — up to 20% off", link: "/search", position: "HOME", sortOrder: 1, active: true },
      { title: "New: Mount Batur sunrise treks", link: "/trip/mount-batur-sunrise-trek", position: "INNER", sortOrder: 2, active: true },
    ],
  });

  await prisma.faq.createMany({
    data: [
      { scope: "SITE", question: "How do I know my booking is confirmed?", answer: "Tours marked ‘Instant confirmation’ are confirmed the moment your payment succeeds — you'll receive a booking reference (BTD-YYYY-NNNNNN) and a voucher by email immediately.", sortOrder: 1, active: true },
      { scope: "SITE", question: "Can I cancel or change my booking?", answer: "Most tours offer free cancellation up to 24–48 hours before the start date. The exact policy is shown on every tour page and on your voucher. Cancel from My Bookings or contact support.", sortOrder: 2, active: true },
      { scope: "SITE", question: "Which payment methods can I use?", answer: "We accept cards (Stripe), bank transfer and pay-on-the-day options where the supplier allows it. All prices are in USD by default — IDR and other currencies are shown for reference.", sortOrder: 3, active: true },
      { scope: "SITE", question: "Are your suppliers verified?", answer: "Every supplier goes through a document verification and approval process run by our platform team. Only approved suppliers can publish tours.", sortOrder: 4, active: true },
      { scope: "SITE", question: "What if my flight is delayed?", answer: "Airport transfers track your flight number and include 60–90 minutes of free waiting. For tours, contact your supplier on WhatsApp from the voucher page as soon as you know.", sortOrder: 5, active: true },
      { scope: "SITE", question: "Do I need to print my voucher?", answer: "No — every voucher has a QR code your supplier can scan straight from your phone. A print-friendly version is available on the voucher page.", sortOrder: 6, active: true },
    ],
  });

  const pages = [
    ["about", "About Bali Things To Do", "## Our story\n\nBali Things To Do is a marketplace built by a small team of Bali-based travelers and local operators. We believe the island's best experiences come from independent, licensed suppliers — so we built the platform that helps them sell directly to you.\n\n## What we do\n\n- Vet and approve every supplier before they can publish\n- Keep prices transparent with no hidden fees\n- Guarantee instant confirmation on hundreds of tours\n- Support you before, during and after your trip\n\n## Our promise\n\nIf something goes wrong on a booking, a real human replies within 24 hours and we'll make it right."],
    ["contact", "Contact us", "## Get in touch\n\n**Email:** hello@balithingstodo.net  \n**Phone:** +62 812 3456 7890  \n**WhatsApp:** +6281234567890  \n**Office:** Jl. Raya Ubud, Bali, Indonesia\n\nWe reply to every message within 24 hours, 7 days a week. For an existing booking, please quote your booking reference (BTD-YYYY-NNNNNN).\n\n## Support\n\nFastest answers: use the [support form](/support) — you'll get a ticket number and replies by email."],
    ["terms", "Terms & Conditions", "## 1. Bookings\n\nAll bookings made through Bali Things To Do are contracts between you and the tour supplier. Your booking reference is issued when the booking is created.\n\n## 2. Payments\n\nPrices are displayed in USD. Payment is captured according to the method selected at checkout (card, bank transfer or pay-on-the-day).\n\n## 3. Cancellations\n\nCancellation terms are shown on each tour page before checkout and on your voucher. Refunds are processed to the original payment method within 5–10 business days.\n\n## 4. Conduct\n\nSuppliers may refuse service in cases of unsafe, illegal or abusive behaviour without refund.\n\n## 5. Liability\n\nWe curate and verify suppliers but the experience itself is delivered by the supplier. Our liability is limited to the amount you paid for the booking."],
    ["privacy", "Privacy Policy", "## What we collect\n\n- Account data: name, email, phone (optional)\n- Booking data: traveler names, dates, pickup details\n- Technical data: pages viewed, device and referral (analytics)\n\n## Why\n\nTo process bookings, send transactional emails (confirmations, reminders), prevent fraud and improve the site.\n\n## Who we share it with\n\nOnly the supplier of the tour you book — and payment providers strictly for processing. We never sell personal data.\n\n## Your rights\n\nRequest a copy or deletion of your data any time at hello@balithingstodo.net.\n\n## Cookies\n\nWe use essential cookies for sessions and optional analytics cookies (configured in Admin → SEO)."],
  ];
  for (const [slug, title, content] of pages) {
    await prisma.page.upsert({
      where: { slug },
      create: { title, slug, content, status: "PUBLISHED" },
      update: { content },
    });
  }

  const posts = [
    {
      slug: "best-things-to-do-in-bali",
      title: "37 Best Things To Do in Bali (2026 Guide)",
      category: "Things to do",
      tags: JSON.stringify(["bali", "itinerary", "activities"]),
      excerpt: "From volcano sunrises to underground rivers — the definitive list of Bali's best experiences, with booking tips for each.",
      content: `Bali rewards the curious. Ten days is enough to fall in love, but a month still leaves things undone — so we asked our local team to distil the island into the experiences that genuinely deserve your time.

## 1. Watch the sunrise from Mount Batur

The trek starts in darkness at around 2 a.m., but nothing prepares you for the moment the sky splits open over Mount Agung. Book a guided sunrise trek and you'll finish with eggs steamed in volcanic steam.

## 2. Ride an ATV through the Ubud jungle

Ninety minutes of mud, river crossings and rice-field single-track. It's the most fun you can have with a helmet on — see our [ATV guide](/trip/ubud-atv-adventure).

## 3. Take a fast boat to Nusa Penida

Kelingking Beach's T-Rex cliff is the shot everyone comes for, but Broken Beach and Angel's Billabong make the whole day sing.

## 4. Raft the Telaga Waja river

Class II–III rapids, jungle gorges and a waterfall swim — Bali's best river is worth the early start.

## 5. Wander the Tegallalang rice terraces

Go before 9 a.m. for empty paths and that classic green staircase of fields.

## More unmissable Bali experiences

| Experience | Time needed | Best for |
| --- | --- | --- |
| Ubud cultural day | Full day | First timers |
| Snorkel with mantas | Half day | Ocean lovers |
| Uluwatu Kecak dance | Evening | Couples |
| Cooking class | Half day | Foodies |
| Kintamani downhill cycling | Half day | Families |

## Practical tips

1. **Book big-ticket tours in advance** — sunrise treks and Penida boats sell out in high season.
2. **Leave buffer days.** Bali traffic is real; don't schedule tight connections.
3. **Carry cash** for entrances and small warungs, cards for everything else.
4. **Respect temple etiquette** — sarong and sash required, shoulders covered.

Ready to plan? Browse all [tours and activities](/search) or start with [Ubud](/destination/ubud).`,
    },
    {
      slug: "ubud-travel-guide",
      title: "The Complete Ubud Travel Guide (2026)",
      category: "Destinations",
      tags: JSON.stringify(["ubud", "guide", "culture"]),
      excerpt: "Where to stay, what to eat and the 12 Ubud experiences worth your morning — written by our Ubud-based team.",
      content: `Ubud is Bali's cultural heart — a town of galleries, temples and palace courtyards wrapped in jungle and rice fields. Here's how to do it properly.

## Why Ubud

Everything within 30 minutes: waterfalls, monkey forest, silver villages, swings above the Ayung valley and some of the island's best restaurants.

## Where to stay

- **Central Ubud** — walk everywhere, busy at night.
- **Sayan / Riverside** — quiet, luxurious, five minutes out.
- **Tegallalang / North** — among the rice fields, cool nights.

## 12 things to do in Ubud

1. Sacred Monkey Forest at 8 a.m.
2. Ubud Royal Palace courtyard
3. Tegallalang rice terraces
4. [ATV jungle adventure](/trip/ubud-atv-adventure)
5. [Ayung river rafting](/trip/white-water-rafting-ayung)
6. Tegenangan waterfall swim
7. Celuk silversmith village
8. [Balinese cooking class](/trip/bali-cooking-class-ubud)
9. Campuhan Ridge walk at sunset
10. Kecak dance at the palace
11. Night market street food
12. [Bali swings](/trip/bali-swings-and-terraces)

## Getting around

Hire a driver by the day (very affordable), rent a scooter if you're confident, or walk — Ubud's centre is compact.

## When to visit

Dry season (April–October) brings the best mornings; green season (November–March) means dramatic clouds and fewer crowds — afternoon showers rarely last long.

Continue planning: [things to do in Bali](/blog/best-things-to-do-in-bali) or [Ubud tours](/ubud-tours).`,
    },
    {
      slug: "nusa-penida-day-trip",
      title: "Nusa Penida Day Trip: Everything You Need To Know",
      category: "Destinations",
      tags: JSON.stringify(["nusa-penida", "island", "snorkeling"]),
      excerpt: "Boats, roads, timing and the exact west-coast itinerary — plan a flawless Penida day trip from Bali.",
      content: `Nusa Penida looks like Bali turned up to eleven: cliffs the size of apartment blocks, water the colour of swimming pools, and manta rays under the surface.

## Getting there

Fast boats leave Sanur every morning (45 minutes). Aim for the 7:30–8:00 a.m. departure to beat the day-trip crowd to Kelingking.

## The west-coast itinerary

1. **Kelingking Beach viewpoint** — arrive before 10 a.m.
2. **Broken Beach** — a collapsed sinkhole arch you can walk around.
3. **Angel's Billabong** — natural infinity pool (swim only at low tide).
4. **Crystal Bay** — snorkel spot and lunch with a view.

A driver is essential: the roads are slow and signage is limited. Our [west tour](/trip/nusa-penida-west-tour) includes boat, car and guide.

## Snorkeling & mantas

Manta Point delivers near-guaranteed manta sightings year-round. See the [manta snorkel safari](/trip/bali-snorkeling-manta-point).

## Practical tips

- Bring cash — ATMs are unreliable outside Toyapakek.
- Motion-sickness tablets for the crossing if you're sensitive.
- The Kelingking descent is 800 steps each way — do it early or skip it.

Back on the mainland? Browse [Nusa Penida tours](/nusa-penida-tours).`,
    },
    {
      slug: "bali-with-kids",
      title: "Bali With Kids: 12 Family-Friendly Adventures",
      category: "Family travel",
      tags: JSON.stringify(["family", "kids", "bali"]),
      excerpt: "Proven family activities across Bali — gentle enough for kids, fun enough for parents, all bookable online.",
      content: `Bali is one of Asia's easiest islands for families: warm water, friendly people and activities that suit every age. Here's what works with kids — tested by our own families.

## Beach days with training wheels

- **Sanur beach** — shallow, calm, no waves.
- **Nusa Dua** — protected lagoon, water parks nearby.
- **Tanjung Benoa** — banana boats and jellyfish-free swimming.

## Adventures kids actually love

1. [Water sports package](/trip/bali-water-sport-adventure) — age 5+
2. [Ayung rafting](/trip/white-water-rafting-ayung) — age 5+
3. [Tibumana waterfall swim](/trip/tibumana-waterfall-tour) — all ages
4. [Cooking class](/trip/bali-cooking-class-ubud) — age 6+
5. [Airport transfer](/trip/bali-airport-transfer-private) — because nobody wants a taxi queue with toddlers

## Days that beat theme parks

- **Bali Safari & Marine Park** — morning feeding shows.
- **Waterbom Kuta** — consistently rated Asia's best waterpark.
- **Sacred Monkey Forest** — hold hands and no snacks.

## Practical tips for parents

1. Book morning activities; storms build in the afternoon.
2. Bring reef-safe sunscreen — most pools ban the spray stuff.
3. Travel insurance that covers water activities, cheap to add.
4. Keep swimsuits in the daypack — spontaneous pool stops happen.

Start with our [family-friendly tours](/search?family=true).`,
    },
  ];
  for (const p of posts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      create: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        featuredImage: `/media/blog/${p.slug}.webp`,
        authorId: admin.id,
        category: p.category,
        tags: p.tags,
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() - between(2, 60) * 86400000),
        viewCount: between(200, 3000),
      },
      update: {},
    });
  }
  console.log("  ✓ CMS: settings, menus, FAQs, pages, blog");

  // ----------------------------------------------------------
  // Programmatic landing pages (unique copy each)
  // ----------------------------------------------------------
  const landings = [
    {
      slug: "ubud-tours", kind: "REGION", title: "Ubud Tours & Activities",
      heading: "The best Ubud tours, chosen by locals",
      intro: "## Ubud tours that go beyond the guidebook\n\nUbud sits at the centre of everything worth doing in Bali: jungle ATV tracks, white-water rivers, terraced rice fields and temples that have stood for centuries. Every Ubud tour below is run by an approved local supplier, priced in USD and confirmed instantly — most with free cancellation up to 24 hours before you go.\n\nWhether you have one morning or three days, start with the experiences Ubud is famous for: a sunrise trek on Mount Batur, a splash down the Ayung river, or an afternoon lost in the Monkey Forest.",
      destinations: ["ubud"], categories: ["adventure", "cultural"],
    },
    {
      slug: "bali-atv", kind: "ACTIVITY", title: "ATV in Bali — Quad Bike Adventures",
      heading: "Bali ATV adventures through jungle, river & mud",
      intro: "## Ride Bali's wildest ATV tracks\n\nATV quad biking has become one of Bali's most-loved activities — and for good reason. The best tracks cut through emerald rice paddies, dip into jungle rivers and finish with a mud shower you'll be talking about for years. Our ATV tours run from Ubud, Canggu and Sanur with hotel pickup, full safety gear and small groups capped at 16 riders.\n\nChoose a morning slot for cooler tracks or an afternoon ride when the light turns gold over the fields.",
      destinations: ["ubud", "canggu"], categories: ["atv", "adventure"],
    },
    {
      slug: "bali-rafting", kind: "ACTIVITY", title: "Bali Rafting — White-Water Adventures",
      heading: "White-water rafting on Bali's best rivers",
      intro: "## Choose your river\n\nTwo rivers dominate Bali rafting: the **Ayung** near Ubud — friendly, scenic and perfect for a first run — and the **Telaga Waja** in Karangasem, longer and faster with Class II–III rapids and a jungle gorge that feels a million miles from the beach clubs.\n\nAll rafting tours include certified guides, life jackets, showers and lunch options. Minimum age is usually 5–7, so families can paddle together.",
      destinations: ["mount-batur", "ubud"], categories: ["rafting"],
    },
    {
      slug: "bali-water-sports", kind: "ACTIVITY", title: "Bali Water Sports & Ocean Adventures",
      heading: "Snorkel, fly and ride — Bali water sports",
      intro: "## Ocean fun, from Tanjung Benoa to Penida\n\nBali's south coast is a playground: banana boats and jet skis at Tanjung Benoa, reef snorkelling off Sanur, and manta rays cruising the cleaning stations of Nusa Penida. Every water sport here is bookable with instant confirmation — gear, instructors and safety equipment included.",
      destinations: ["kuta", "nusa-penida"], categories: ["water-sports"],
    },
    {
      slug: "nusa-penida-tours", kind: "REGION", title: "Nusa Penida Tours & Day Trips",
      heading: "Nusa Penida day trips & island tours",
      intro: "## Cross the strait to Penida\n\nForty-five minutes by fast boat from Sanur, Nusa Penida delivers the most dramatic coastline in Bali: the T-Rex cliff of Kelingking, the sinkhole of Broken Beach, manta rays at Manta Point. Roads are slow and the island is big — a guided tour with boat, car and driver is the sane way to see it all in a day.",
      destinations: ["nusa-penida"], categories: ["nusa-penida", "water-sports"],
    },
    {
      slug: "seminyak-tours", kind: "REGION", title: "Seminyak Tours & Experiences",
      heading: "The best tours & day trips from Seminyak",
      intro: "## Escape or indulge — both from Seminyak\n\nSeminyak's beaches and beach clubs are the point of staying here, but the island beyond is calling: Tanah Lot's sea temple at sunset, Ubud's cultural core, or a private car for the day with your own itinerary. Every tour below offers pickup right from your Seminyak hotel.",
      destinations: ["seminyak", "kuta"], categories: ["private", "cultural"],
    },
    {
      slug: "canggu-tours", kind: "REGION", title: "Canggu Tours & Activities",
      heading: "Tours & adventures from Canggu",
      intro: "## Canggu beyond the surf\n\nCanggu draws surfers and remote workers, but the adventures start before your flat white gets cold: ATV tracks through Ubud's backlands, rafting on the Ayung, sunrise on Mount Batur, or a full-day loop of the island's temples — all with pickup from your Canggu guesthouse.",
      destinations: ["canggu", "ubud"], categories: ["adventure", "atv"],
    },
    {
      slug: "bali-sunrise-tours", kind: "ACTIVITY", title: "Bali Sunrise Tours & Morning Treks",
      heading: "Chase Bali's best sunrises",
      intro: "## Mornings worth the alarm\n\nA Bali sunrise is a full production: the climb by torchlight, the cold air at altitude, the sky catching fire over Mount Agung and Lake Batur steaming below. Beyond Mount Batur, catch first light from Uluwatu's cliffs, the sails of Sanur's beach and the waterfalls of the highlands — all runnable in a morning.",
      destinations: ["mount-batur", "kintamani"], categories: ["sunrise", "trekking"],
    },
    {
      slug: "bali-tours", kind: "COLLECTION", title: "Bali Tours — The Complete Collection",
      heading: "Every great Bali tour, one page",
      intro: "## The full Bali tour collection\n\nFrom Kuta's water sports to Kintamani's volcano trails, this is every bookable Bali tour on the platform — filtered by what travellers actually rate. Start with the classics (Ubud day tour, Nusa Penida, Mount Batur sunrise) and build outward. All prices are per person in USD, with instant confirmation and free cancellation on most tours.",
      destinations: [], categories: ["adventure", "cultural"],
    },
    {
      slug: "bali-activities", kind: "COLLECTION", title: "Bali Activities — 100+ Things To Do",
      heading: "Bali activities for every kind of traveler",
      intro: "## Find your Bali\n\nAdrenaline, culture, ocean or easy family days — Bali does all of it within an hour's drive. This collection groups every activity on the platform: rafting and ATV for thrill-seekers, temples and cooking classes for culture, snorkelling safaris and water parks for the kids. Filter by price, duration and rating to build your week.",
      destinations: [], categories: ["adventure", "family", "water-sports"],
    },
  ];
  for (const l of landings) {
    await prisma.landingPage.upsert({
      where: { slug: l.slug },
      create: {
        slug: l.slug, kind: l.kind, title: l.title, heading: l.heading,
        intro: l.intro,
        highlights: JSON.stringify(["Instant confirmation", "Approved local suppliers", "Free cancellation on most tours", "Best-price guarantee"]),
        faq: JSON.stringify([
          { q: `Are ${l.title.toLowerCase()} bookable online?`, a: "Yes — every listing shows live availability and is confirmed instantly after payment." },
          { q: "Can I cancel?", a: "Most experiences include free cancellation up to 24–48 hours before the start date." },
          { q: "Do you arrange hotel pickup?", a: "Pickup zones are listed on each tour page; many are included free of charge." },
        ]),
        relatedDestinationIds: JSON.stringify(l.destinations.map((d) => destinations[d]?.id).filter(Boolean)),
        relatedCategoryIds: JSON.stringify(l.categories.map((c) => categories[c]?.id).filter(Boolean)),
        heroImage: `/media/destinations/${l.destinations[0] ?? "ubud"}.webp`,
        status: "PUBLISHED",
        sortOrder: landings.indexOf(l),
      },
      update: {},
    });
  }
  console.log("  ✓ landing pages");

  // ----------------------------------------------------------
  // SEO meta examples
  // ----------------------------------------------------------
  await prisma.seoMeta.createMany({
    data: [
      {
        entityType: "TRIP",
        entityId: products.get("ubud-atv-adventure")!.id as string,
        title: "Ubud ATV Adventure — Jungle, River & Mud Track | Bali",
        description:
          "Ride Bali's wildest ATV tracks through jungle, rivers and rice fields. 90 minutes of quad biking from Ubud with gear, guide & pickup. Instant confirmation, free cancellation.",
        focusKeyword: "ATV Ubud",
        keywords: JSON.stringify(["ATV Ubud", "quad biking Bali", "Ubud adventure"]),
      },
      {
        entityType: "HOME",
        entityId: "home",
        title: "Best Bali Things To Do — Tours, Activities & Adventures",
        description:
          "Discover the best tours, activities, adventures and experiences in Bali. Book ATV, rafting, Nusa Penida & sunrise treks with trusted local suppliers.",
        focusKeyword: "Bali things to do",
        keywords: JSON.stringify(["Bali things to do", "Bali tours", "Bali activities"]),
      },
    ],
  });

  // ----------------------------------------------------------
  // Support tickets
  // ----------------------------------------------------------
  const ticket1 = await prisma.supportTicket.create({
    data: {
      reference: `SUP-${year}-000001`,
      subject: "Pickup time change for BTD booking",
      message: "Hi, can we move the pickup from 08:00 to 09:00 for booking next Tuesday? Thanks!",
      email: customers[0].email,
      name: customers[0].name,
      userId: customers[0].id,
      category: "BOOKING",
      status: "OPEN",
      priority: "NORMAL",
    },
  });
  await prisma.supportMessage.create({
    data: {
      ticketId: ticket1.id,
      authorId: customers[0].id,
      authorLabel: customers[0].name,
      body: "Hi, can we move the pickup from 08:00 to 09:00 for booking next Tuesday? Thanks!",
    },
  });
  await prisma.supportTicket.create({
    data: {
      reference: `SUP-${year}-000002`,
      subject: "Supplier: bank details update",
      message: "Please update our bank account number for payouts.",
      email: wayan.email,
      name: "I Wayan Sudarma",
      category: "SUPPLIER",
      status: "IN_PROGRESS",
      priority: "HIGH",
      adminNote: "Awaiting signed bank letter.",
    },
  });

  // ----------------------------------------------------------
  // Notifications & audit samples
  // ----------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, type: "NEW_SUPPLIER", title: "New supplier application", body: "Ketut Explorers applied to join the marketplace.", link: "/admin/suppliers" },
      { userId: admin.id, type: "NEW_PRODUCT", title: "Product awaiting review", body: "Kintamani Downhill Volcano Cycling was submitted.", link: "/admin/products" },
      { userId: admin.id, type: "REFUND_REQUEST", title: "Refund requested", body: "A paid booking was cancelled — refund pending.", link: "/admin/payments" },
      { userId: wayan.userId, type: "PAYOUT_NOTIFICATION", title: "Payout processed", body: "Your last payout of $152.50 was transferred.", link: "/supplier/payouts" },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { actorLabel: "Platform Admin (ADMIN)", action: "SETTINGS_CHANGED", entityType: "Setting", entityId: null, summary: `Platform Admin changed default commission from 10% to 15% on 7 October 2026.`, ip: "127.0.0.1", createdAt: new Date(Date.now() - 86400000 * 3) },
      { actorLabel: "Platform Admin (ADMIN)", action: "SUPPLIER_APPROVED", entityType: "Supplier", entityId: wayan.id, summary: `Platform Admin approved supplier Wayan Tours Bali.`, ip: "127.0.0.1", createdAt: new Date(Date.now() - 86400000 * 10) },
      { actorLabel: "I Wayan Sudarma (SUPPLIER)", action: "PRODUCT_PRICE_CHANGED", entityType: "Product", entityId: products.get("ubud-atv-adventure")!.id as string, summary: `I Wayan Sudarma changed ATV price from $45 to $45 on 7 October 2026.`, before: JSON.stringify({ priceAdultCents: 4000 }), after: JSON.stringify({ priceAdultCents: 4500 }), ip: "127.0.0.1" },
    ],
  });

  // Analytics events (funnel numbers for the dashboard)
  for (let i = 0; i < 120; i++) {
    await prisma.analyticsEvent.create({
      data: {
        name: pick(["page_view", "page_view", "product_view", "search", "checkout"]),
        path: pick(["/", "/search", "/trip/ubud-atv-adventure", "/destination/ubud"]),
        createdAt: new Date(Date.now() - between(0, 13) * 86400000),
      },
    });
  }

  const totals = {
    users: await prisma.user.count(),
    suppliers: await prisma.supplier.count(),
    products: await prisma.product.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
  };
  console.log("✅ Seed complete in", ((Date.now() - t0) / 1000).toFixed(1) + "s", totals);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
