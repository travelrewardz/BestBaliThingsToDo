import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify, EDITABLE_STATUSES, type TourInput } from "@/lib/tour-schema";

/**
 * Server-side helpers for supplier-owned tours (Product + options + media).
 */

/** Product columns derived from a validated tour payload. */
export function tourProductData(input: TourInput) {
  return {
    name: input.name,
    shortTitle: input.shortTitle ?? null,
    subtitle: input.subtitle ?? null,
    description: input.description,
    categoryId: input.categoryId ?? null,
    destinationId: input.destinationId ?? null,
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
    inclusions: JSON.stringify(input.inclusions),
    exclusions: JSON.stringify(input.exclusions),
    whatToBring: JSON.stringify(input.whatToBring),
    importantInfo: input.importantInfo ?? null,
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

/** Applies the option/media child rows of a payload to an existing product. */
export async function syncTourChildren(tx: Prisma.TransactionClient, productId: string, input: TourInput) {
  // --- pricing options -------------------------------------------------
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
      active: option.active,
      sortOrder: index,
    };
    if (option.id) {
      await tx.productOption.updateMany({ where: { id: option.id, productId }, data });
    } else {
      await tx.productOption.create({ data: { ...data, productId } });
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
