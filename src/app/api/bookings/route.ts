import { handle, jsonOk, ApiError, parseJson, requireApiUser, rateLimit, getIp } from "@/lib/api";
import { canAny, resolveUserFromToken, tokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBooking, BookingError } from "@/lib/bookings";
import { AvailabilityError } from "@/lib/availability";
import { z } from "zod";

const schema = z.object({
  productId: z.string().min(1),
  optionId: z.string().nullish(),
  date: z.string().min(4),
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50).optional(),
  infants: z.number().int().min(0).max(50).optional(),
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().max(30).nullish(),
  pickupLocation: z.string().max(120).nullish(),
  specialRequests: z.string().max(1000).nullish(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        label: z.string().trim().min(1).max(120),
        type: z.enum(["READ_ONLY", "TEXT", "SELECT"]),
        value: z.string().trim().max(500).default(""),
      })
    )
    .max(20)
    .optional(),
  couponCode: z.string().max(40).nullish(),
});

/**
 * POST /api/bookings — creates a booking with atomic seat reservation.
 * Signed-in customers book on their own account; guests (no session) can
 * book as a guest using the contact details in the payload — no account or
 * promotion applies for them. Seats are held in a transaction so two buyers
 * can never take the last seat.
 */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    rateLimit(`booking:${getIp(req)}`, 10, 60_000);
    const user = await resolveUserFromToken(tokenFromRequest(req));
    if (user) {
      if (user.role !== "CUSTOMER") {
        throw new ApiError(403, "Only customer accounts can book tours", "forbidden");
      }
      if (!(await canAny(user, ["customer.booking.create"]))) {
        throw new ApiError(403, "Missing permission", "forbidden");
      }
    }
    const body = await parseJson(req, schema);

    // A signed-in booking always belongs to that account (data isolation);
    // a guest supplies their own contact email.
    if (user && body.customerEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new ApiError(400, "Use the email of the signed-in account", "email_mismatch");
    }

    try {
      const booking = await createBooking({
        ...body,
        userId: user?.id ?? null,
      });
      return jsonOk(
        {
          reference: booking.reference,
          id: booking.id,
          status: booking.status,
          totalCents: booking.totalCents,
          currency: booking.currency,
          redirect: `/checkout/${booking.id}`,
        },
        { status: 201 }
      );
    } catch (err) {
      if (err instanceof BookingError) throw new ApiError(err.status, err.message, err.code);
      if (err instanceof AvailabilityError) throw new ApiError(409, err.message, err.code);
      throw err;
    }
  });
}

/** GET /api/bookings — the current customer's bookings. */
export async function GET(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["CUSTOMER", "SUPPLIER", "ADMIN"] });
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const where =
      user.role === "ADMIN"
        ? { ...(status ? { status } : {}) }
        : user.role === "SUPPLIER"
          ? { supplierId: user.supplierId!, ...(status ? { status } : {}) }
          : { customerId: user.id, ...(status ? { status } : {}) };
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    void getIp;
    return jsonOk({ bookings });
  });
}
