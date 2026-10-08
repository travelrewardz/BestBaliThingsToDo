import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { cancelBooking, setBookingStatus, BookingError } from "@/lib/bookings";
import { audit } from "@/lib/audit";
import { z } from "zod";

const statusSchema = z.object({ status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]) });

/**
 * POST /api/bookings/[ref]/action
 * body: { action: "cancel" | "status", reason?, status? }
 *
 * Access rules:
 *  - the booking's customer can cancel their own booking
 *  - the owning supplier or an admin can transition status
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ ref: string }> }
) {
  return handle(req, async (req) => {
    const { ref } = await ctx.params;
    const user = await requireApiUser(req);
    const body = await parseJson(req, z.object({
      action: z.enum(["cancel", "status"]),
      reason: z.string().max(500).optional(),
      status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]).optional(),
    }));

    const booking = await prisma.booking.findUnique({ where: { reference: ref } });
    if (!booking) throw new ApiError(404, "Booking not found", "not_found");

    const isOwner = booking.customerId === user.id && user.role === "CUSTOMER";
    const isSupplier =
      user.role === "SUPPLIER" && user.supplierId === booking.supplierId;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isSupplier && !isAdmin) {
      throw new ApiError(403, "You don't have access to this booking", "forbidden");
    }

    try {
      if (body.action === "cancel") {
        if (!isOwner && !isAdmin && !isSupplier) throw new ApiError(403, "Forbidden", "forbidden");
        // customers may only cancel before the tour per policy window
        if (isOwner && booking.status === "COMPLETED") {
          throw new ApiError(409, "Completed bookings cannot be cancelled", "not_cancellable");
        }
        const updated = await cancelBooking(booking.id, { user, reason: body.reason });
        await audit({
          user,
          action: "BOOKING_CANCELLED",
          entityType: "Booking",
          entityId: booking.id,
          summary: `${user.name} cancelled booking ${ref}.`,
          ip: null,
        });
        return jsonOk({ booking: updated });
      }

      // status transitions: supplier/admin only
      if (!isSupplier && !isAdmin) {
        throw new ApiError(403, "Only the supplier or admin can change status", "forbidden");
      }
      const parsed = statusSchema.parse({ status: body.status });
      const updated = await setBookingStatus(booking.id, parsed.status, user);
      await audit({
        user,
        action: "BOOKING_STATUS_CHANGED",
        entityType: "Booking",
        entityId: booking.id,
        summary: `${user.name} changed ${ref} from ${booking.status} to ${parsed.status}.`,
      });
      return jsonOk({ booking: updated });
    } catch (err) {
      if (err instanceof BookingError) throw new ApiError(err.status, err.message, err.code);
      if (err instanceof z.ZodError) throw new ApiError(400, "Invalid status", "validation");
      throw err;
    }
  });
}
