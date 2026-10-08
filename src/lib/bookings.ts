import type { Booking, Prisma, Product, ProductOption, Supplier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AvailabilityError,
  assertBookableWindow,
  releaseSeats,
  reserveSeats,
  tourDateKey,
} from "@/lib/availability";
import {
  commissionFor,
  couponDiscount,
  priceForDate,
  promotionDiscount,
  validateCoupon,
} from "@/lib/finance";
import { applyBps, formatMoney } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { notify, notifyRole, notifySupplier, pushRealtime } from "@/lib/notifications";
import { randomToken } from "@/lib/auth";
import { logger, logError } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth";

export class BookingError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.message = message;
  }
}

export type QuoteInput = {
  productId: string;
  optionId?: string | null;
  date: string;
  adults: number;
  children?: number;
  infants?: number;
  couponCode?: string | null;
  userId?: string | null;
};

export type QuoteResult = {
  price: { adult: number; child: number; infant: number };
  subtotalCents: number;
  discountCents: number;
  couponCode?: string;
  promotionId?: string;
  discountReason?: string;
  totalCents: number;
  commissionRateBps: number;
  commissionCents: number;
  supplierEarningsCents: number;
  currency: string;
  totalTravelers: number;
};

type ProductFull = Product & {
  supplier: Supplier;
  options: ProductOption[];
};

async function loadBookableProduct(productId: string): Promise<ProductFull> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { supplier: true, options: true },
  });
  if (!product) throw new BookingError(404, "not_found", "Tour not found");
  if (product.status !== "PUBLISHED") {
    throw new BookingError(409, "unavailable", "This tour is not currently bookable");
  }
  if (product.supplier.status === "SUSPENDED" || product.supplier.status === "INACTIVE") {
    throw new BookingError(409, "unavailable", "This supplier is not accepting bookings");
  }
  return product;
}

function normaliseCounts(input: QuoteInput): {
  adults: number;
  children: number;
  infants: number;
  total: number;
} {
  const adults = Math.max(0, Math.floor(Number(input.adults) || 0));
  const children = Math.max(0, Math.floor(Number(input.children) || 0));
  const infants = Math.max(0, Math.floor(Number(input.infants) || 0));
  if (adults < 1) throw new BookingError(400, "invalid", "At least one adult is required");
  const total = adults + children + infants;
  if (total > 100) throw new BookingError(400, "invalid", "Too many travelers");
  return { adults, children, infants, total };
}

async function defaultCommissionBps(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: "default_commission_bps" } });
  const n = s ? parseInt(s.value, 10) : NaN;
  return Number.isFinite(n) ? n : 1500;
}

/** Computes all prices/discounts/commission without reserving anything. */
export async function quoteBooking(input: QuoteInput): Promise<QuoteResult> {
  const product = await loadBookableProduct(input.productId);
  const date = tourDateKey(input.date);
  if (Number.isNaN(date.getTime())) {
    throw new BookingError(400, "invalid", "Invalid tour date");
  }
  assertBookableWindow(product, date);

  const counts = normaliseCounts(input);
  if (product.tourType === "GROUP" && counts.total > product.maxParticipants) {
    throw new BookingError(
      400,
      "invalid",
      `This group tour accepts a maximum of ${product.maxParticipants} travelers`
    );
  }
  if (counts.total < product.minParticipants) {
    throw new BookingError(
      400,
      "invalid",
      `Minimum ${product.minParticipants} participant(s) required`
    );
  }

  const option = input.optionId
    ? product.options.find((o) => o.id === input.optionId && o.active)
    : undefined;
  if (input.optionId && !option) {
    throw new BookingError(400, "invalid", "Selected option is not available");
  }

  const price = await priceForDate(product, date, option);
  const subtotalCents =
    counts.adults * price.adult +
    counts.children * price.child +
    counts.infants * price.infant;

  // Discount: explicit coupon wins, otherwise an automatic promotion applies.
  let discountCents = 0;
  let couponCode: string | undefined;
  let promotionId: string | undefined;
  let discountReason: string | undefined;

  if (input.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: input.couponCode.trim().toUpperCase() },
    });
    const userUsage = input.userId
      ? await prisma.booking.count({
          where: {
            customerId: input.userId,
            couponCode: input.couponCode.trim().toUpperCase(),
            status: { notIn: ["CANCELLED"] },
          },
        })
      : 0;
    const check = validateCoupon(coupon, {
      subtotalCents,
      productId: product.id,
      supplierId: product.supplierId,
      userUsage,
    });
    if (!check.ok) throw new BookingError(400, "invalid_coupon", check.reason);
    discountCents = couponDiscount(check.coupon, subtotalCents);
    couponCode = check.coupon.code;
    discountReason = `Coupon ${check.coupon.code}`;
  } else {
    const promotions = await prisma.promotion.findMany({ where: { active: true } });
    const promo = promotionDiscount(promotions, {
      subtotalCents,
      tourDate: date,
      productId: product.id,
      supplierId: product.supplierId,
    });
    if (promo.discountCents > 0) {
      discountCents = promo.discountCents;
      promotionId = promo.promotionId;
      discountReason = "Automatic promotion applied";
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents);
  const defaultBps = await defaultCommissionBps();
  const comm = commissionFor(totalCents, {
    product,
    supplier: product.supplier,
    defaultBps,
  });

  return {
    price,
    subtotalCents,
    discountCents,
    couponCode,
    promotionId,
    discountReason,
    totalCents,
    commissionRateBps: comm.rateBps,
    commissionCents: comm.commissionCents,
    supplierEarningsCents: comm.supplierCents,
    currency: product.currency,
    totalTravelers: counts.total,
  };
}

/** Sequential booking reference: BTD-2026-000123 (atomic via UPDATE…RETURNING). */
export async function nextReference(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
  now = new Date()
): Promise<string> {
  const year = now.getUTCFullYear();
  const key = `seq_booking_${year}`;
  await tx.setting
    .create({
      data: { key, value: "0", group: "system", label: "Booking sequence", type: "number" },
    })
    .catch(() => undefined); // already exists
  try {
    const rows = await tx.$queryRaw<{ value: string | number }[]>`
      UPDATE "Setting" SET "value" = CAST("value" AS INTEGER) + 1
      WHERE "key" = ${key} RETURNING "value"`;
    const n = Number(rows?.[0]?.value ?? 1);
    if (Number.isFinite(n) && n > 0) {
      return `BTD-${year}-${String(n).padStart(6, "0")}`;
    }
  } catch (err) {
    logError(err, { where: "nextReference" });
  }
  // Fallback: derive from count (unique index still protects against collisions).
  const start = new Date(Date.UTC(year, 0, 1));
  const count = await tx.booking.count({ where: { createdAt: { gte: start } } });
  return `BTD-${year}-${String(count + 1).padStart(6, "0")}`;
}

export type CreateBookingInput = QuoteInput & {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  pickupLocation?: string | null;
  specialRequests?: string | null;
  userId: string;
};

/**
 * Creates a booking atomically:
 *  - validates window/capacity
 *  - reserves seats with optimistic locking (double-booking proof)
 *  - writes booking + items + commission record in one transaction
 *  - then fires notifications / emails / realtime updates
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const quote = await quoteBooking(input);
  const product = await loadBookableProduct(input.productId);
  const date = tourDateKey(input.date);
  const counts = normaliseCounts(input);
  const option = input.optionId
    ? product.options.find((o) => o.id === input.optionId && o.active) ?? null
    : null;

  let booking: Booking;
  try {
    booking = await prisma.$transaction(
      async (tx) => {
        await reserveSeats(tx, product, date, counts.total);
        const reference = await nextReference(tx);
        const created = await tx.booking.create({
          data: {
            reference,
            customerId: input.userId,
            supplierId: product.supplierId,
            productSlug: product.slug,
            productName: product.name,
            productImage: (await tx.productMedia.findFirst({
              where: { productId: product.id },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            }))?.url ?? null,
            status: "AWAITING_PAYMENT",
            tourDate: date,
            tourTime: option?.startTime ?? null,
            pickupLocation: input.pickupLocation ?? null,
            specialRequests: input.specialRequests ?? null,
            customerName: input.customerName.trim(),
            customerEmail: input.customerEmail.trim().toLowerCase(),
            customerPhone: input.customerPhone ?? null,
            customerUserId: input.userId,
            adults: counts.adults,
            children: counts.children,
            infants: counts.infants,
            totalTravelers: counts.total,
            subtotalCents: quote.subtotalCents,
            discountCents: quote.discountCents,
            totalCents: quote.totalCents,
            currency: quote.currency,
            couponCode: quote.couponCode ?? null,
            promotionId: quote.promotionId ?? null,
            commissionRateBps: quote.commissionRateBps,
            commissionCents: quote.commissionCents,
            supplierEarningsCents: quote.supplierEarningsCents,
            voucherCode: randomToken(8),
          },
        });
        await tx.bookingItem.create({
          data: {
            bookingId: created.id,
            productId: product.id,
            optionId: option?.id ?? null,
            itemName: product.name,
            itemSlug: product.slug,
            date,
            adults: counts.adults,
            children: counts.children,
            infants: counts.infants,
            seats: counts.total,
            unitAdultCents: quote.price.adult,
            unitChildCents: quote.price.child,
            unitInfantCents: quote.price.infant,
            lineTotalCents: quote.subtotalCents,
          },
        });
        await tx.commission.create({
          data: {
            bookingId: created.id,
            supplierId: product.supplierId,
            grossCents: quote.totalCents,
            rateBps: quote.commissionRateBps,
            platformCents: quote.commissionCents,
            supplierCents: quote.supplierEarningsCents,
            currency: quote.currency,
          },
        });
        return created;
      },
      { timeout: 20_000, maxWait: 5_000 }
    );
  } catch (err) {
    if (err instanceof AvailabilityError) {
      throw new BookingError(
        409,
        err.code === "CLOSED" ? "date_closed" : "sold_out",
        err.message
      );
    }
    throw err;
  }

  // ---- post-commit side effects (never fail the booking) ----
  void sideEffectsAfterCreate(booking, product, input).catch((err) =>
    logError(err, { where: "createBooking.sideEffects", booking: booking.reference })
  );
  return booking;
}

async function sideEffectsAfterCreate(
  booking: Booking,
  product: ProductFull,
  input: CreateBookingInput
): Promise<void> {
  await prisma.product
    .update({ where: { id: product.id }, data: { bookingCount: { increment: 1 } } })
    .catch(() => undefined);
  await prisma.supplier
    .update({
      where: { id: product.supplierId },
      data: { totalBookings: { increment: 1 } },
    })
    .catch(() => undefined);

  const total = formatMoney(booking.totalCents, booking.currency);
  const earnings = formatMoney(booking.supplierEarningsCents, booking.currency);
  const dateStr = booking.tourDate.toISOString().slice(0, 10);

  await Promise.all([
    notify({
      userId: booking.customerId,
      type: "BOOKING_RECEIVED",
      title: `Booking ${booking.reference} received`,
      body: `${booking.productName} — ${dateStr}. Complete payment to confirm.`,
      link: `/account/bookings`,
    }),
    notifySupplier(product.supplierId, {
      type: "NEW_BOOKING",
      title: `New booking ${booking.reference}`,
      body: `${booking.productName} · ${dateStr} · ${booking.totalTravelers} traveler(s)`,
      link: `/supplier/bookings`,
    }),
    notifyRole("ADMIN", {
      type: "NEW_BOOKING",
      title: `New booking ${booking.reference}`,
      body: `${booking.customerName} booked ${booking.productName} (${total})`,
      link: `/admin/bookings`,
    }),
    sendEmail({
      to: booking.customerEmail,
      toUserId: booking.customerId,
      template: "bookingConfirmation",
      vars: {
        reference: booking.reference,
        customerName: booking.customerName,
        productName: booking.productName,
        tourDate: dateStr,
        tourTime: booking.tourTime,
        travelers: String(booking.totalTravelers),
        pickupLocation: booking.pickupLocation,
        supplierName: product.supplier.companyName,
        total,
        status: "Awaiting payment",
        cancellationPolicy:
          product.cancellationPolicy ||
          (product.freeCancellation
            ? "Free cancellation up to 24 hours before the tour"
            : "See tour terms"),
      },
    }),
    sendEmail({
      to: product.supplier.email,
      template: "supplierBookingNotification",
      vars: {
        reference: booking.reference,
        productName: booking.productName,
        tourDate: dateStr,
        tourTime: booking.tourTime,
        travelers: String(booking.totalTravelers),
        pickupLocation: booking.pickupLocation,
        customerName: booking.customerName,
        specialRequests: booking.specialRequests,
        supplierEarnings: earnings,
        status: "Awaiting payment",
      },
    }),
  ]);

  pushRealtime({ admin: true, supplierId: product.supplierId }, "booking:new", {
    reference: booking.reference,
    productName: booking.productName,
    tourDate: dateStr,
    totalCents: booking.totalCents,
    status: booking.status,
  });

  await prisma.analyticsEvent
    .create({
      data: {
        name: "add_to_booking",
        path: `/trip/${product.slug}`,
        userId: input.userId,
        valueCents: booking.totalCents,
        meta: JSON.stringify({ reference: booking.reference, productId: product.id }),
      },
    })
    .catch(() => undefined);
}

/** Marks a payment as succeeded → PAID/CONFIRMED, notifies everyone. */
export async function markBookingPaid(
  bookingId: string,
  opts: {
    provider: string;
    externalId?: string | null;
    amountCents: number;
    meta?: unknown;
  }
): Promise<Booking> {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { supplier: true, items: true },
  });
  if (!existing) throw new BookingError(404, "not_found", "Booking not found");
  if (["PAID", "CONFIRMED", "COMPLETED"].includes(existing.status)) return existing; // idempotent

  const product = await prisma.product.findUnique({
    where: { id: existing.items[0]?.productId ?? "" },
  });

  const booking = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "PAID",
        confirmedAt: new Date(),
      },
    });
    await tx.payment.create({
      data: {
        bookingId,
        provider: opts.provider,
        status: "SUCCEEDED",
        amountCents: opts.amountCents,
        currency: b.currency,
        externalId: opts.externalId ?? null,
        meta: opts.meta ? JSON.stringify(opts.meta).slice(0, 4000) : null,
        paidAt: new Date(),
      },
    });
    if (product?.instantConfirm) {
      return tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
    }
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: "SUPPLIER_CONFIRMATION_REQUIRED" },
    });
  });

  const total = formatMoney(booking.totalCents, booking.currency);
  const dateStr = booking.tourDate.toISOString().slice(0, 10);

  await Promise.all([
    notify({
      userId: booking.customerId,
      type: "PAYMENT_RECEIVED",
      title: `Payment received — ${booking.reference}`,
      body: `${booking.productName} is confirmed for ${dateStr}.`,
      link: `/account/bookings`,
    }),
    notifySupplier(booking.supplierId, {
      type: "BOOKING_CONFIRMED",
      title: `Payment received — ${booking.reference}`,
      body: `${booking.customerName} paid ${total}`,
      link: `/supplier/bookings`,
    }),
    notifyRole("ADMIN", {
      type: "PAYMENT_RECEIVED",
      title: `Payment ${booking.reference}`,
      body: `${total} received from ${booking.customerName}`,
      link: `/admin/bookings`,
    }),
    sendEmail({
      to: booking.customerEmail,
      toUserId: booking.customerId,
      template: "paymentConfirmation",
      vars: {
        reference: booking.reference,
        customerName: booking.customerName,
        productName: booking.productName,
        tourDate: dateStr,
        total,
        provider: opts.provider.replace("_", " "),
      },
    }),
    sendEmail({
      to: booking.customerEmail,
      toUserId: booking.customerId,
      template: "bookingConfirmation",
      vars: {
        reference: booking.reference,
        customerName: booking.customerName,
        productName: booking.productName,
        tourDate: dateStr,
        tourTime: booking.tourTime,
        travelers: String(booking.totalTravelers),
        pickupLocation: booking.pickupLocation,
        supplierName: existing.supplier.companyName,
        total,
        status: booking.status === "CONFIRMED" ? "Confirmed" : "Awaiting supplier confirmation",
        cancellationPolicy: product?.cancellationPolicy || "See tour terms",
      },
    }),
  ]);

  pushRealtime(
    { admin: true, supplierId: booking.supplierId, userId: booking.customerId },
    "booking:paid",
    { reference: booking.reference, status: booking.status }
  );

  await prisma.analyticsEvent
    .create({
      data: {
        name: "purchase",
        path: `/checkout`,
        userId: booking.customerId,
        valueCents: booking.totalCents,
        meta: JSON.stringify({ reference: booking.reference }),
      },
    })
    .catch(() => undefined);

  return booking;
}

/** Cancels a booking and releases its seats (idempotent). */
export async function cancelBooking(
  bookingId: string,
  actor: { user: SessionUser; reason?: string }
): Promise<Booking> {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { items: true, supplier: true, payments: true },
  });
  if (!existing) throw new BookingError(404, "not_found", "Booking not found");

  const cancellable = ["PENDING", "AWAITING_PAYMENT", "PAID", "CONFIRMED", "SUPPLIER_CONFIRMATION_REQUIRED"];
  if (!cancellable.includes(existing.status)) {
    throw new BookingError(
      409,
      "not_cancellable",
      `A booking with status ${existing.status} cannot be cancelled`
    );
  }

  const wasPaid = existing.payments.some((p) => p.status === "SUCCEEDED");

  const booking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: wasPaid ? "REFUND_REQUESTED" : "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: actor.reason ?? null,
      },
    });
    for (const item of existing.items) {
      await releaseSeats(tx, item.productId, tourDateKey(item.date), item.seats);
    }
    if (wasPaid) {
      await tx.refund.upsert({
        where: { bookingId },
        create: {
          bookingId,
          amountCents: existing.totalCents,
          reason: actor.reason ?? null,
          status: "REQUESTED",
          requestedBy: actor.user.id,
        },
        update: { status: "REQUESTED", reason: actor.reason ?? null },
      });
    }
    return updated;
  });

  const dateStr = booking.tourDate.toISOString().slice(0, 10);
  await Promise.all([
    notify({
      userId: booking.customerId,
      type: "BOOKING_CANCELLED",
      title: `Booking ${booking.reference} cancelled`,
      body: wasPaid ? "A refund request has been created." : "No payment was captured.",
      link: `/account/bookings`,
    }),
    notifySupplier(booking.supplierId, {
      type: "BOOKING_CANCELLED",
      title: `Cancelled: ${booking.reference}`,
      body: `${booking.productName} · ${dateStr} — seats released`,
      link: `/supplier/bookings`,
    }),
    notifyRole("ADMIN", {
      type: "BOOKING_CANCELLED",
      title: `Cancelled: ${booking.reference}`,
      body: `by ${actor.user.name}${wasPaid ? " — refund requested" : ""}`,
      link: `/admin/bookings`,
    }),
    sendEmail({
      to: booking.customerEmail,
      toUserId: booking.customerId,
      template: "bookingCancelledCustomer",
      vars: {
        reference: booking.reference,
        customerName: booking.customerName,
        productName: booking.productName,
        tourDate: dateStr,
        refundNote: wasPaid ? "Your refund is being processed." : "",
      },
    }),
    sendEmail({
      to: existing.supplier.email,
      template: "bookingCancelledSupplier",
      vars: { reference: booking.reference, productName: booking.productName, tourDate: dateStr },
    }),
    prisma.analyticsEvent
      .create({
        data: {
          name: "cancellation",
          path: `/account/bookings`,
          userId: actor.user.id,
          meta: JSON.stringify({ reference: booking.reference }),
        },
      })
      .catch(() => undefined),
  ]);

  pushRealtime(
    { admin: true, supplierId: booking.supplierId, userId: booking.customerId },
    "booking:cancelled",
    { reference: booking.reference }
  );

  logger.info("booking cancelled", { reference: booking.reference, by: actor.user.id });
  return booking;
}

/** Supplier/admin status transitions (confirm, complete, no-show). */
export async function setBookingStatus(
  bookingId: string,
  status: string,
  actor: SessionUser
): Promise<Booking> {
  const allowed: Record<string, string[]> = {
    CONFIRMED: ["SUPPLIER_CONFIRMATION_REQUIRED", "PAID"],
    COMPLETED: ["CONFIRMED", "SUPPLIER_CONFIRMATION_REQUIRED", "PAID"],
    NO_SHOW: ["CONFIRMED", "SUPPLIER_CONFIRMATION_REQUIRED"],
  };
  const current = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { supplier: true },
  });
  if (!current) throw new BookingError(404, "not_found", "Booking not found");
  if (!allowed[status]?.includes(current.status)) {
    throw new BookingError(
      409,
      "invalid_transition",
      `Cannot move booking from ${current.status} to ${status}`
    );
  }
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status,
      confirmedAt: status === "CONFIRMED" ? new Date() : current.confirmedAt,
      completedAt: status === "COMPLETED" ? new Date() : current.completedAt,
    },
  });

  await notify({
    userId: booking.customerId,
    type: status === "COMPLETED" ? "REVIEW_REMINDER" : "BOOKING_CONFIRMED",
    title:
      status === "COMPLETED"
        ? `How was ${booking.productName}?`
        : `Booking ${booking.reference} confirmed`,
    body: status === "COMPLETED" ? "Share your experience — leave a review." : undefined,
    link: status === "COMPLETED" ? `/account/reviews` : `/account/bookings`,
  });

  if (status === "COMPLETED") {
    await sendEmail({
      to: booking.customerEmail,
      toUserId: booking.customerId,
      template: "reviewRequest",
      vars: { customerName: booking.customerName, productName: booking.productName, reference: booking.reference },
    });
  }

  pushRealtime(
    { admin: true, supplierId: booking.supplierId, userId: booking.customerId },
    "booking:status",
    { reference: booking.reference, status, by: actor.id }
  );
  return booking;
}

/** Debug/quote helper for checkout display. */
export function money(cents: number, currency = "USD"): string {
  return formatMoney(cents, currency);
}

export { applyBps };
