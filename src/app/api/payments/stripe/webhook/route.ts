import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeSignature } from "@/lib/payments";
import { markBookingPaid } from "@/lib/bookings";
import { logError, logger } from "@/lib/logger";

/**
 * POST /api/payments/stripe/webhook
 * Verifies the Stripe signature header, then finalises the booking.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data?.object;
    const intentId = String(intent?.id || "");
    try {
      const payment = await prisma.payment.findFirst({
        where: { externalId: intentId },
        orderBy: { createdAt: "desc" },
      });
      if (payment && payment.status !== "SUCCEEDED") {
        await markBookingPaid(payment.bookingId, {
          provider: "STRIPE",
          externalId: intentId,
          amountCents: payment.amountCents,
          meta: { webhook: true },
        });
      }
    } catch (err) {
      logError(err, { where: "stripe.webhook" });
      return NextResponse.json({ error: "processing_error" }, { status: 500 });
    }
  }

  logger.info("stripe webhook", { type: event.type });
  return NextResponse.json({ received: true });
}
