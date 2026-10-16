import { z } from "zod";

/**
 * Validation for supplier-submitted tours (Product + ProductOption + OptionTier + ProductMedia).
 * Kept free of Prisma imports so it can be shared with client components.
 */

const money = z.number().int().min(0).max(1_000_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Rich text written with the in-form editor (markdown). Deliberately has no
 * length cap — suppliers may write as much as they need.
 */
const optionalRich = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

/** A price tier inside a pricing option (e.g. "2 travellers", "Group of 4+"). */
export const optionTierSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(60),
  minPax: z.number().int().min(1).max(500).default(1),
  maxPax: z.number().int().min(1).max(1000).nullable().optional(),
  priceCents: money.default(0),
});

export const tourOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  startTime: optionalText(20),
  description: optionalText(500),
  priceAdultCents: money.optional(),
  priceChildCents: money.optional(),
  priceInfantCents: money.optional(),
  capacityOffset: z.number().int().min(-50).max(200).default(0),
  /** Agent / member net discount in basis points (1000 = 10% off). Null = no discount. */
  agentNetBps: z.number().int().min(0).max(9000).nullable().optional(),
  active: z.boolean().default(true),
  tiers: z.array(optionTierSchema).max(20).default([]),
});

/** One destination with the regions (within that destination) the tour covers. */
export const destinationLinkSchema = z.object({
  id: z.string().trim().min(1).max(40),
  regions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const itineraryItemSchema = z.object({
  time: optionalText(30),
  title: z.string().trim().min(1),
  text: optionalRich,
});

export const faqItemSchema = z.object({
  q: z.string().trim().min(1).max(300),
  a: z.string().trim().min(1).max(2000),
});

export const tourMediaSchema = z.object({
  url: z.string().trim().min(1).max(500),
  alt: optionalText(160),
  isPrimary: z.boolean().optional(),
});

export const tourSchema = z.object({
  // --- General ---
  name: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  /** Short description for cards / SEO meta. */
  shortDescription: z.string().trim().min(10).max(300),
  description: z.string().trim().min(20).max(20000),
  seoTitle: optionalText(160),
  seoDescription: optionalText(300),
  seoKeywords: optionalText(300),

  // Multiple destinations (with regions) + multiple categories
  destinationLinks: z.array(destinationLinkSchema).max(20).default([]),
  categoryLinks: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  /** Legacy single-destination id, used by older clients / imports. */
  destinationId: optionalText(40),

  // Logistics
  location: optionalText(160),
  meetingPoint: optionalText(200),
  pickupInfo: optionalText(500),
  durationHours: z.number().min(0.5).max(240),
  durationLabel: optionalText(60),
  tourType: z.enum(["GROUP", "PRIVATE"]),
  minParticipants: z.number().int().min(1).max(200),
  maxParticipants: z.number().int().min(1).max(500),
  difficulty: z.enum(["EASY", "MODERATE", "CHALLENGING"]),
  instantConfirm: z.boolean().default(true),
  freeCancellation: z.boolean().default(true),
  familyFriendly: z.boolean().default(true),

  // Pricing
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase()),
  priceAdultCents: money,
  priceChildCents: money.default(0),
  priceInfantCents: money.default(0),

  // Capacity / availability
  defaultCapacity: z.number().int().min(1).max(1000),
  bookingCutoffHours: z.number().int().min(0).max(720),
  maxAdvanceDays: z.number().int().min(1).max(1095),

  // Content
  highlights: z.array(z.string().trim().min(1)).max(30).default([]),
  inclusions: z.array(z.string().trim().min(1).max(300)).max(40).default([]),
  exclusions: z.array(z.string().trim().min(1).max(300)).max(40).default([]),
  whatToBring: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  importantInfo: optionalRich,
  itinerary: z.array(itineraryItemSchema).max(60).default([]),
  faq: z.array(faqItemSchema).max(30).default([]),

  // Child records
  options: z.array(tourOptionSchema).max(20).default([]),
  media: z.array(tourMediaSchema).max(10).default([]),

  /** true = submit for admin review instead of saving as a draft. */
  submit: z.boolean().default(false),
});

export type TourInput = z.infer<typeof tourSchema>;
export type TourOptionInput = z.infer<typeof tourOptionSchema>;
export type OptionTierInput = z.infer<typeof optionTierSchema>;
export type DestinationLink = z.infer<typeof destinationLinkSchema>;
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;

/** "Ubud ATV Adventure!" → "ubud-atv-adventure". */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "tour"
  );
}

/** Currencies offered in the supplier UI. */
export const CURRENCIES = ["USD", "IDR", "EUR", "AUD", "GBP", "SGD"] as const;

/** Statuses a supplier may edit freely and (re)submit for review. */
export const EDITABLE_STATUSES = ["DRAFT", "CHANGES_REQUESTED", "REJECTED"] as const;

/** Statuses that are still under review (editing is allowed, resubmission is a no-op). */
export const IN_REVIEW_STATUSES = ["SUBMITTED", "IN_REVIEW"] as const;
