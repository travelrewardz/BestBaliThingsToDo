import type { Prisma, Product, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Tx = Prisma.TransactionClient | PrismaClient;

export class AvailabilityError extends Error {
  code: "SOLD_OUT" | "CLOSED" | "CONFLICT" | "LEAD_TIME" | "OUT_OF_WINDOW";
  constructor(
    code: AvailabilityError["code"],
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

/** Normalise any date to UTC midnight (the canonical tour-date key). */
export function tourDateKey(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

export function weekdayOf(date: Date): number {
  return date.getUTCDay(); // 0=Sun .. 6=Sat
}

/**
 * Capacity for a product on a date:
 *  1. closed override            → closed (blackout date)
 *  2. capacity override          → that capacity
 *  3. weekday-specific rule      → rule capacity
 *  4. all-weekdays rule          → rule capacity
 *  5. product.defaultCapacity
 */
export async function computeCapacity(
  product: Pick<Product, "id" | "defaultCapacity">,
  date: Date
): Promise<{ capacity: number; closed: boolean }> {
  const override = await prisma.availabilityOverride.findUnique({
    where: { productId_date: { productId: product.id, date } },
  });
  if (override?.closed) return { capacity: 0, closed: true };
  if (override && override.capacity !== null)
    return { capacity: override.capacity, closed: false };

  const dow = weekdayOf(date);
  const rules = await prisma.availabilityRule.findMany({
    where: {
      productId: product.id,
      active: true,
      OR: [{ weekday: dow }, { weekday: null }],
    },
  });
  const exact = rules.find((r) => r.weekday === dow) ?? rules.find((r) => r.weekday === null);
  if (exact) return { capacity: exact.capacity, closed: false };
  return { capacity: product.defaultCapacity, closed: false };
}

/** Create/refresh the materialised day row. Throws when the date is closed. */
export async function ensureDay(
  tx: Tx,
  product: Pick<Product, "id" | "defaultCapacity">,
  date: Date
) {
  const { capacity, closed } = await computeCapacity(product, date);
  if (closed) throw new AvailabilityError("CLOSED", "This date is not available");
  try {
    return await tx.availabilityDay.upsert({
      where: { productId_date: { productId: product.id, date } },
      create: { productId: product.id, date, capacity },
      update: { capacity }, // rules remain the source of truth
    });
  } catch (err) {
    // Concurrent create race → row exists now.
    const existing = await tx.availabilityDay.findUnique({
      where: { productId_date: { productId: product.id, date } },
    });
    if (existing) return existing;
    throw err;
  }
}

/**
 * Atomically reserves seats with optimistic concurrency:
 *   read booked → check capacity → UPDATE ... WHERE booked = previous value.
 * A concurrent writer that changed `booked` makes count=0 and we retry,
 * so capacity can never be exceeded (no double booking).
 */
export async function reserveSeats(
  tx: Tx,
  product: Pick<Product, "id" | "defaultCapacity">,
  date: Date,
  seats: number
): Promise<void> {
  if (seats <= 0) throw new AvailabilityError("CONFLICT", "Invalid seat count");
  for (let attempt = 0; attempt < 6; attempt++) {
    const day = await ensureDay(tx, product, date);
    if (day.booked + seats > day.capacity) {
      throw new AvailabilityError(
        "SOLD_OUT",
        "Not enough places left for this date"
      );
    }
    const res = await tx.availabilityDay.updateMany({
      where: { id: day.id, booked: day.booked },
      data: { booked: { increment: seats } },
    });
    if (res.count === 1) return;
    // Someone else modified the row — retry.
  }
  throw new AvailabilityError(
    "CONFLICT",
    "This date is selling fast, please try again"
  );
}

/** Releases seats (cancellation / rollback). Never goes below zero. */
export async function releaseSeats(
  tx: Tx,
  productId: string,
  date: Date,
  seats: number
): Promise<void> {
  await tx.availabilityDay.updateMany({
    where: { productId, date, booked: { gte: seats } },
    data: { booked: { decrement: seats } },
  });
}

/** Remaining seats for display (creates nothing). */
export async function remainingSeats(
  productId: string,
  date: Date,
  product?: Pick<Product, "id" | "defaultCapacity">
): Promise<{ remaining: number; capacity: number; closed: boolean }> {
  const p = product ?? (await prisma.product.findUnique({ where: { id: productId } }));
  if (!p) return { remaining: 0, capacity: 0, closed: true };
  const { capacity, closed } = await computeCapacity(p, date);
  if (closed) return { remaining: 0, capacity: 0, closed: true };
  const day = await prisma.availabilityDay.findUnique({
    where: { productId_date: { productId, date } },
  });
  const booked = day?.booked ?? 0;
  return { remaining: Math.max(0, capacity - booked), capacity, closed: false };
}

/** Validates lead-time rules for a tour date. */
export function assertBookableWindow(
  product: Pick<Product, "bookingCutoffHours" | "maxAdvanceDays">,
  date: Date,
  now = new Date()
): void {
  const ms = date.getTime() - now.getTime();
  if (ms < product.bookingCutoffHours * 3600 * 1000) {
    throw new AvailabilityError(
      "LEAD_TIME",
      `Bookings for this tour close ${product.bookingCutoffHours} hours before the start date`
    );
  }
  if (ms > product.maxAdvanceDays * 24 * 3600 * 1000) {
    throw new AvailabilityError(
      "OUT_OF_WINDOW",
      `You can book up to ${product.maxAdvanceDays} days in advance`
    );
  }
}
