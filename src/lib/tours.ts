import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify, EDITABLE_STATUSES, type TourInput, type DestinationLink } from "@/lib/tour-schema";

/**
 * Server-side helpers for supplier-owned tours (Product + options + tiers + media).
 */

/**
 * Human duration wording: the supplier's own label wins, otherwise anything
 * spanning a night (24 h+) reads as days and day trips as hours/minutes.
 */
export function formatDuration(tour: { durationLabel?: string | null; durationHours: number }): string {
  return (
    tour.durationLabel ||
    (tour.durationHours >= 24
      ? `${Math.round(tour.durationHours / 24)} days`
      : tour.durationHours <= 1
        ? `${Math.round(tour.durationHours * 60)} minutes`
        : `${tour.durationHours} hours`)
  );
}

/** Product columns derived from a validated tour payload. */
export function tourProductData(input: TourInput) {
  const primaryDestinationId = input.destinationLinks[0]?.id ?? input.destinationId ?? null;
  const primaryCategoryId = input.categoryLinks[0] ?? null;
  return {
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    seoKeywords: input.seoKeywords ?? null,
    categoryId: primaryCategoryId,
    categoryLinks: JSON.stringify(input.categoryLinks),
    tripLength: input.tripLength,
    destinationId: primaryDestinationId,
    destinationLinks: JSON.stringify(input.destinationLinks),
    location: input.location ?? null,
    meetingPoint: input.meetingPoint ?? null,
    pickupInfo: input.pickupInfo ?? null,
    durationHours: input.durationHours,
    durationLabel: input.durationLabel ?? null,
    tourType: input.tourType,
    minParticipants: input.minParticipants,
    maxParticipants: input.maxParticipants,
    difficulty: input.difficulty,
    instantConfirm: input.instantConfirm,
    freeCancellation: input.freeCancellation,
    familyFriendly: input.familyFriendly,
    currency: input.currency,
    priceAdultCents: input.priceAdultCents,
    priceChildCents: input.priceChildCents,
    priceInfantCents: input.priceInfantCents,
    defaultCapacity: input.defaultCapacity,
    bookingCutoffHours: input.bookingCutoffHours,
    maxAdvanceDays: input.maxAdvanceDays,
    highlights: JSON.stringify(input.highlights),
    itinerary: JSON.stringify(input.itinerary),
    inclusions: JSON.stringify(input.inclusions),
    exclusions: JSON.stringify(input.exclusions),
    whatToBring: JSON.stringify(input.whatToBring),
    importantInfo: input.importantInfo ?? null,
    faq: JSON.stringify(input.faq),
  };
}

/** Postgres-safe unique slug: "ubud-atv", "ubud-atv-2", … */
export async function uniqueTourSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; await slugTaken(slug, excludeId); i++) {
    slug = `${root}-${i}`.slice(0, 70);
  }
  return slug;
}

async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const found = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(found && found.id !== excludeId);
}

/**
 * Status transition on save:
 *  - submit from DRAFT / CHANGES_REQUESTED / REJECTED → SUBMITTED (+ submittedAt)
 *  - anything already under review or live keeps its status
 */
export function nextTourStatus(
  current: string,
  submit: boolean
): { status: string; submittedAt?: Date } {
  if (submit && (EDITABLE_STATUSES as readonly string[]).includes(current)) {
    return { status: "SUBMITTED", submittedAt: new Date() };
  }
  return { status: current };
}

/** Applies the option / tier / media child rows of a payload to an existing product. */
export async function syncTourChildren(tx: Prisma.TransactionClient, productId: string, input: TourInput) {
  // --- pricing options + their tiers ----------------------------------
  const keptIds = input.options.map((o) => o.id).filter((id): id is string => Boolean(id));
  await tx.productOption.deleteMany({
    where: { productId, ...(keptIds.length ? { id: { notIn: keptIds } } : {}) },
  });
  for (const [index, option] of input.options.entries()) {
    const data = {
      name: option.name,
      startTime: option.startTime ?? null,
      description: option.description ?? null,
      priceAdultCents: option.priceAdultCents ?? null,
      priceChildCents: option.priceChildCents ?? null,
      priceInfantCents: option.priceInfantCents ?? null,
      capacityOffset: option.capacityOffset,
      agentNetBps: option.agentNetBps ?? null,
      active: option.active,
      sortOrder: index,
    };

    let optionId = option.id;
    if (optionId) {
      await tx.productOption.updateMany({ where: { id: optionId, productId }, data });
    } else {
      const created = await tx.productOption.create({ data: { ...data, productId }, select: { id: true } });
      optionId = created.id;
    }

    const keptTierIds = option.tiers.map((t) => t.id).filter((id): id is string => Boolean(id));
    await tx.optionTier.deleteMany({
      where: { optionId, ...(keptTierIds.length ? { id: { notIn: keptTierIds } } : {}) },
    });
    for (const [tierIndex, tier] of option.tiers.entries()) {
      const tierData = {
        label: tier.label,
        minPax: tier.minPax,
        maxPax: tier.maxPax ?? null,
        priceCents: tier.priceCents,
        sortOrder: tierIndex,
      };
      if (tier.id) {
        await tx.optionTier.updateMany({ where: { id: tier.id, optionId }, data: tierData });
      } else {
        await tx.optionTier.create({ data: { ...tierData, optionId } });
      }
    }

    // Booking questions (additional info) asked of customers who pick this option.
    const keptQuestionIds = option.questions.map((q) => q.id).filter((id): id is string => Boolean(id));
    await tx.optionBookingQuestion.deleteMany({
      where: { optionId, ...(keptQuestionIds.length ? { id: { notIn: keptQuestionIds } } : {}) },
    });
    for (const [qIndex, question] of option.questions.entries()) {
      const questionData = {
        label: question.label,
        type: question.type,
        remark: question.remark ?? null,
        choices: JSON.stringify(question.type === "SELECT" ? question.choices : []),
        required: question.required,
        sortOrder: qIndex,
      };
      if (question.id) {
        await tx.optionBookingQuestion.updateMany({
          where: { id: question.id, optionId },
          data: questionData,
        });
      } else {
        await tx.optionBookingQuestion.create({ data: { ...questionData, optionId } });
      }
    }
  }

  // --- media -----------------------------------------------------------
  await tx.productMedia.deleteMany({ where: { productId } });
  for (const [index, item] of input.media.entries()) {
    await tx.productMedia.create({
      data: {
        productId,
        url: item.url,
        alt: item.alt ?? "",
        isPrimary: index === 0,
        sortOrder: index,
      },
    });
  }
}

/** Loads a tour owned by this supplier or throws a 404-ish null. */
export async function findOwnedTour(productId: string, supplierId: string) {
  return prisma.product.findFirst({ where: { id: productId, supplierId } });
}

/** JSON array column → string[] (defensive against legacy/hand-written values). */
export function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** JSON `[{ id, regions }]` column → DestinationLink[] (defensive). */
export function parseDestinationLinks(raw: string | null | undefined): DestinationLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is { id: string; regions?: unknown } => Boolean(v) && typeof v.id === "string")
      .map((v) => ({
        id: v.id,
        regions: Array.isArray(v.regions)
          ? v.regions.filter((r): r is string => typeof r === "string")
          : [],
      }));
  } catch {
    return [];
  }
}

type PricedOption = { priceAdultCents: number | null; tiers?: { priceCents: number }[] };

/**
 * Lowest price a tour can actually be booked at — the cheapest pricing tier
 * across all options (falling back to the option's own adult price).
 * Returns null when no tier/option price is set, so callers fall back to the base price.
 */
export function lowestOptionPriceCents(options: PricedOption[] | null | undefined): number | null {
  let min: number | null = null;
  const consider = (v: number | null | undefined) => {
    if (v && v > 0 && (min === null || v < min)) min = v;
  };
  for (const option of options ?? []) {
    for (const tier of option.tiers ?? []) consider(tier.priceCents);
    consider(option.priceAdultCents);
  }
  return min;
}

/**
 * The "from" price shown on cards: the lowest tier when tiers/options exist,
 * otherwise the product base price.
 */
export function effectiveFromPriceCents(
  basePriceCents: number,
  options: PricedOption[] | null | undefined
): number {
  return lowestOptionPriceCents(options) ?? basePriceCents;
}

/** Ensures every referenced category / destination id exists (throws 400 otherwise). */
export async function assertTourRefs(
  categoryIds: string[],
  destinationIds: string[]
): Promise<void> {
  const { ApiError } = await import("@/lib/api");
  if (categoryIds.length) {
    const unique = new Set(categoryIds);
    const found = await prisma.category.findMany({
      where: { id: { in: [...unique] } },
      select: { id: true },
    });
    if (found.length !== unique.size) throw new ApiError(400, "Unknown category", "validation");
  }
  if (destinationIds.length) {
    const unique = new Set(destinationIds);
    const found = await prisma.destination.findMany({
      where: { id: { in: [...unique] } },
      select: { id: true },
    });
    if (found.length !== unique.size) throw new ApiError(400, "Unknown destination", "validation");
  }
}

/** Category + destination ids referenced by a tour payload (incl. legacy single destination). */
export function tourRefIds(input: { categoryLinks: string[]; destinationLinks: { id: string }[]; destinationId?: string }) {
  return {
    categoryIds: input.categoryLinks,
    destinationIds: [
      ...input.destinationLinks.map((d) => d.id),
      ...(input.destinationId ? [input.destinationId] : []),
    ],
  };
}

/** JSON `[{ time, title, text }]` column → ItineraryItem[] (defensive). */
export function parseItinerary(
  raw: string | null | undefined
): { time: string; title: string; text: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
      .map((v) => ({
        time: typeof v.time === "string" ? v.time : "",
        title: typeof v.title === "string" ? v.title : "",
        text: typeof v.text === "string" ? v.text : "",
      }))
      .filter((v) => v.title || v.time || v.text);
  } catch {
    return [];
  }
}

/** JSON `[{ q, a }]` column → FaqItem[] (defensive). */
export function parseFaq(raw: string | null | undefined): { q: string; a: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
      .map((v) => ({
        q: typeof v.q === "string" ? v.q : typeof v.question === "string" ? v.question : "",
        a: typeof v.a === "string" ? v.a : typeof v.answer === "string" ? v.answer : "",
      }))
      .filter((v) => v.q || v.a);
  } catch {
    return [];
  }
}
