import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { startPayment, availableProviders, type ProviderId } from "@/lib/payments";
import { BookingError } from "@/lib/bookings";
import { z } from "zod";

const schema = z.object({
  bookingId: z.string().min(1),
  provider: z.enum(["STRIPE", "BANK_TRANSFER", "ONSITE", "TEST_CARD", "PAYPAL", "MIDTRANS", "XENDIT"]),
});

/** GET /api/payments — providers enabled for this environment. */
export async function GET(req: Request) {
  return handle(req, async () => {
    return jsonOk({ providers: availableProviders() });
  });
}

/** POST /api/payments — start a payment for a booking the user owns. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { permissions: ["customer.booking.create"] });
    const body = await parseJson(req, schema);

    const booking = await prisma.booking.findUnique({ where: { id: body.bookingId } });
    if (!booking) throw new ApiError(404, "Booking not found", "not_found");
    if (user.role === "CUSTOMER" && booking.customerId !== user.id) {
      throw new ApiError(403, "This booking belongs to another account", "forbidden");
    }
    if (user.role === "SUPPLIER" && booking.supplierId !== user.supplierId) {
      throw new ApiError(403, "This booking belongs to another supplier", "forbidden");
    }
    if (!["CUSTOMER", "ADMIN"].includes(user.role)) {
      throw new ApiError(403, "Forbidden", "forbidden");
    }

    try {
      const quote = await startPayment(booking.id, body.provider as ProviderId);
      return jsonOk(quote);
    } catch (err) {
      if (err instanceof BookingError) throw new ApiError(err.status, err.message, err.code);
      throw err;
    }
  });
}
