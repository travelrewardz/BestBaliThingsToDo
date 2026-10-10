import { z } from "zod";

/**
 * Validation for supplier-submitted tours (Product + ProductOption + ProductMedia).
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

export const tourOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  startTime: optionalText(20),
  description: optionalText(300),
  priceAdultCents: money.optional(),
  priceChildCents: money.optional(),
  priceInfantCents: money.optional(),
  capacityOffset: z.number().int().min(-50).max(200).default(0),
  active: z.boolean().default(true),
});

export const tourMediaSchema = z.object({
  url: z.string().trim().min(1).max(500),
  alt: optionalText(160),
  isPrimary: z.boolean().optional(),
});

export const tourSchema = z.object({
  // Basics
  name: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  shortTitle: optionalText(160),
  subtitle: optionalText(200),
  description: z.string().trim().min(20).max(20000),
  categoryId: optionalText(40),
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
  highlights: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  inclusions: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  exclusions: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  whatToBring: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  importantInfo: optionalText(2000),

  // Child records
  options: z.array(tourOptionSchema).max(20).default([]),
  media: z.array(tourMediaSchema).max(10).default([]),

  /** true = submit for admin review instead of saving as a draft. */
  submit: z.boolean().default(false),
});

export type TourInput = z.infer<typeof tourSchema>;
export type TourOptionInput = z.infer<typeof tourOptionSchema>;

/** "Ubud ATV Adventure!" → "ubud-atv-adventure". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "tour";
}

/** Statuses a supplier may edit freely and (re)submit for review. */
export const EDITABLE_STATUSES = ["DRAFT", "CHANGES_REQUESTED", "REJECTED"] as const;

/** Statuses that are still under review (editing is allowed, resubmission is a no-op). */
export const IN_REVIEW_STATUSES = ["SUBMITTED", "IN_REVIEW"] as const;
