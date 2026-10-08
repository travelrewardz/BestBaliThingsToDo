import { handle, jsonOk, ApiError, parseJson, requireApiUser, getIp } from "@/lib/api";
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
  couponCode: z.string().max(40).nullish(),
});

/**
 * POST /api/bookings — creates a booking with atomic seat reservation.
 * Requires a customer session; seats are held in a transaction so two
 * buyers can never take the last seat.
 */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, {
      roles: ["CUSTOMER"],
      permissions: ["customer.booking.create"],
    });
    const body = await parseJson(req, schema);

    // The booking always belongs to the logged-in user (data isolation).
    if (body.customerEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new ApiError(400, "Use the email of the signed-in account", "email_mismatch");
    }

    try {
      const booking = await createBooking({
        ...body,
        userId: user.id,
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
