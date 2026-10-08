import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { BookingError, markBookingPaid } from "@/lib/bookings";
import { logError } from "@/lib/logger";

/**
 * Payment provider architecture.
 *
 * Providers implement the same contract, so Stripe/PayPal/Midtrans/Xendit
 * can be enabled purely by configuration. Local development and
 * bank-transfer/onsite payments work without any provider keys.
 */

export type ProviderId =
  | "STRIPE"
  | "BANK_TRANSFER"
  | "ONSITE"
  | "TEST_CARD"
  | "PAYPAL"
  | "MIDTRANS"
  | "XENDIT";

export type ProviderQuote = {
  provider: ProviderId;
  clientSecret?: string; // Stripe PaymentIntent client secret
  redirectUrl?: string;
  instructions?: string[];
};

export function stripeEnabled(): boolean {
  return Boolean(env.stripeSecretKey);
}

/** Options the checkout page offers, filtered by configuration. */
export function availableProviders(): ProviderId[] {
  const list: ProviderId[] = [];
  if (stripeEnabled()) list.push("STRIPE");
  list.push("BANK_TRANSFER", "ONSITE");
  if (process.env.NODE_ENV !== "production") list.push("TEST_CARD");
  return list;
}

async function stripeRequest(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    logError(new Error(json?.error?.message || "Stripe error"), { stripe: path });
    throw new BookingError(502, "stripe_error", "Payment provider error");
  }
  return json;
}

/** Starts a payment for a booking according to the chosen provider. */
export async function startPayment(
  bookingId: string,
  provider: ProviderId
): Promise<ProviderQuote> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError(404, "not_found", "Booking not found");
  if (!["AWAITING_PAYMENT", "PENDING"].includes(booking.status)) {
    throw new BookingError(409, "invalid_state", "This booking is not awaiting payment");
  }

  switch (provider) {
    case "STRIPE": {
      if (!stripeEnabled()) {
        throw new BookingError(503, "not_configured", "Card payments are not configured");
      }
      const intent = await stripeRequest("payment_intents", {
        amount: String(booking.totalCents),
        currency: booking.currency.toLowerCase(),
        "metadata[bookingReference]": booking.reference,
        "automatic_payment_methods[enabled]": "true",
      });
      await upsertPendingPayment(bookingId, "STRIPE", booking.totalCents, booking.currency, intent.id);
      return { provider, clientSecret: intent.client_secret };
    }

    case "BANK_TRANSFER": {
      await ensurePendingPayment(bookingId, "BANK_TRANSFER", booking.totalCents, booking.currency);
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "PENDING" },
      });
      return {
        provider,
        instructions: [
          "Transfer the total amount to: Bali Things To Do · Bank Central Asia (BCA) · 1234567890",
          `Use booking reference ${booking.reference} as the payment description.`,
          "Your booking is confirmed automatically once payment is received (usually within a few hours).",
        ],
      };
    }

    case "ONSITE": {
      await ensurePendingPayment(bookingId, "CASH", booking.totalCents, booking.currency);
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: booking.status === "AWAITING_PAYMENT" ? "SUPPLIER_CONFIRMATION_REQUIRED" : booking.status },
      });
      return {
        provider,
        instructions: [
          "Pay in cash or by card directly with the supplier on the day of the tour.",
          "Your booking is held for you — please arrive 10 minutes before pickup time.",
        ],
      };
    }

    case "TEST_CARD": {
      if (process.env.NODE_ENV === "production") {
        throw new BookingError(403, "forbidden", "Not available in production");
      }
      await markBookingPaid(bookingId, {
        provider: "MANUAL",
        externalId: `test_${Date.now()}`,
        amountCents: booking.totalCents,
        meta: { test: true },
      });
      return { provider, redirectUrl: `/booking/${booking.reference}` };
    }

    default:
      throw new BookingError(501, "not_implemented", `Provider ${provider} is not enabled`);
  }
}

async function upsertPendingPayment(
  bookingId: string,
  provider: string,
  amountCents: number,
  currency: string,
  externalId?: string
) {
  const existing = await prisma.payment.findFirst({
    where: { bookingId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { provider, status: "PENDING", amountCents, externalId: externalId ?? existing.externalId },
    });
    return;
  }
  await prisma.payment.create({
    data: { bookingId, provider, status: "PENDING", amountCents, currency, externalId: externalId ?? null },
  });
}

const ensurePendingPayment = upsertPendingPayment;

/** Verifies a Stripe webhook signature (t=...,v1=... header scheme). */
export function verifyStripeSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  // 5 minute tolerance
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
