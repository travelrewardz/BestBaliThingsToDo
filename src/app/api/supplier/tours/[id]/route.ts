import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifyRole } from "@/lib/notifications";
import { Prisma } from "@prisma/client";
import { tourSchema } from "@/lib/tour-schema";
import {
  tourProductData,
  uniqueTourSlug,
  syncTourChildren,
  nextTourStatus,
} from "@/lib/tours";

/** Loads a tour owned by this supplier, or throws 404. */
async function requireOwnedTour(productId: string, supplierId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, supplierId } });
  if (!product) throw new ApiError(404, "Tour not found", "not_found");
  return product;
}

/**
 * PATCH /api/supplier/tours/[id] — update a tour's content, pricing options and media.
 * `submit: true` moves a draft / rejected tour back into admin review.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["SUPPLIER"] });
    if (!user.supplierId) throw new ApiError(403, "No supplier profile on this account", "no_supplier");

    const existing = await requireOwnedTour(id, user.supplierId);
    const input = await parseJson(req, tourSchema);
    if (input.maxParticipants < input.minParticipants) {
      throw new ApiError(400, "Maximum participants must be at least the minimum", "validation");
    }

    const slug = input.slug && input.slug !== existing.slug
      ? await uniqueTourSlug(input.slug, existing.id)
      : existing.slug;
    const transition = nextTourStatus(existing.status, input.submit);

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: existing.id },
        data: { ...tourProductData(input), slug, ...transition },
        select: { id: true, name: true, slug: true, status: true },
      });
      await syncTourChildren(tx, updated.id, input);
      return updated;
    });

    await audit({
      user,
      action: "supplier.tour.update",
      entityType: "Product",
      entityId: product.id,
      summary: `${user.name} updated tour "${product.name}" (${product.status}).`,
    });

    if (transition.submittedAt) {
      await notifyRole("ADMIN", {
        type: "SYSTEM",
        title: "Tour resubmitted for review",
        body: product.name,
        link: "/admin",
      });
    }

    return jsonOk({ tour: product });
  });
}

/** DELETE /api/supplier/tours/[id] — remove a tour that has no bookings yet. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["SUPPLIER"] });
    if (!user.supplierId) throw new ApiError(403, "No supplier profile on this account", "no_supplier");

    const existing = await requireOwnedTour(id, user.supplierId);
    await assertNoBookings(existing.id);

    try {
      await prisma.product.delete({ where: { id: existing.id } });
    } catch (err) {
      // Bookings reference the product with ON DELETE RESTRICT: Prisma surfaces this
      // either as P2003 or as a raw Postgres 23001 from the connector.
      const message = err instanceof Error ? err.message : "";
      const foreignKeyViolation =
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") ||
        message.includes("BookingItem_productId_fkey") ||
        message.includes("23001");
      if (foreignKeyViolation) throw hasBookingsError();
      throw err;
    }

    await audit({
      user,
      action: "supplier.tour.delete",
      entityType: "Product",
      entityId: existing.id,
      summary: `${user.name} deleted tour "${existing.name}".`,
    });

    return jsonOk({ deleted: true });
  });
}

function hasBookingsError() {
  return new ApiError(
    409,
    "This tour has bookings and cannot be deleted. Ask support to unpublish it instead.",
    "has_bookings"
  );
}

/** Tour with existing bookings must be unpublished, not deleted. */
async function assertNoBookings(productId: string) {
  const items = await prisma.bookingItem.count({ where: { productId } });
  if (items > 0) throw hasBookingsError();
}
