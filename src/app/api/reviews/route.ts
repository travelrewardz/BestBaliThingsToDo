import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { notifyRole, pushRealtime } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(10).max(3000),
  serviceRating: z.number().int().min(1).max(5).optional(),
  guideRating: z.number().int().min(1).max(5).optional(),
  valueRating: z.number().int().min(1).max(5).optional(),
});

/**
 * POST /api/reviews — verified reviews only: the reviewer must own a
 * COMPLETED booking for that product. New reviews await moderation.
 */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { permissions: ["customer.review.create"] });
    const body = await parseJson(req, createSchema);

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      include: { items: true, review: true },
    });
    if (!booking) throw new ApiError(404, "Booking not found", "not_found");
    if (booking.customerId !== user.id) {
      throw new ApiError(403, "You can only review your own bookings", "forbidden");
    }
    if (booking.status !== "COMPLETED") {
      throw new ApiError(
        409,
        "You can review a tour once it is completed",
        "not_completed"
      );
    }
    if (booking.review) throw new ApiError(409, "This booking was already reviewed", "exists");

    const productId = booking.items[0]?.productId;
    if (!productId) throw new ApiError(409, "Booking has no tour items", "invalid");

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        productId,
        customerId: user.id,
        rating: body.rating,
        title: body.title || null,
        body: body.body,
        serviceRating: body.serviceRating ?? null,
        guideRating: body.guideRating ?? null,
        valueRating: body.valueRating ?? null,
        status: "PENDING",
      },
    });

    await notifyRole("ADMIN", {
      type: "NEW_REVIEW",
      title: `New review for ${booking.productName}`,
      body: `${body.rating}★ — awaiting moderation`,
      link: "/admin/reviews",
    });
    await audit({
      user,
      action: "REVIEW_SUBMITTED",
      entityType: "Review",
      entityId: review.id,
      summary: `${user.name} submitted a ${body.rating}★ review for ${booking.productName}.`,
    });
    pushRealtime({ admin: true }, "review:new", { id: review.id, rating: body.rating });

    return jsonOk({ review }, { status: 201 });
  });
}

/** GET /api/reviews?productId= — public approved reviews. */
export async function GET(req: Request) {
  return handle(req, async (req) => {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    if (!productId) throw new ApiError(400, "productId required", "validation");
    const reviews = await prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { customer: { select: { name: true } } },
    });
    return jsonOk({ reviews });
  });
}
