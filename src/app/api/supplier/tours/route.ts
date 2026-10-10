import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifyRole } from "@/lib/notifications";
import { tourSchema } from "@/lib/tour-schema";
import { tourProductData, uniqueTourSlug, syncTourChildren, assertTourRefs, tourRefIds } from "@/lib/tours";

/**
 * POST /api/supplier/tours — create a tour for the signed-in supplier.
 * Saves as DRAFT, or submits for admin review when `submit` is true.
 */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["SUPPLIER"] });
    if (!user.supplierId) throw new ApiError(403, "No supplier profile on this account", "no_supplier");

    const input = await parseJson(req, tourSchema);
    if (input.maxParticipants < input.minParticipants) {
      throw new ApiError(400, "Maximum participants must be at least the minimum", "validation");
    }
    const { categoryIds, destinationIds } = tourRefIds(input);
    await assertTourRefs(categoryIds, destinationIds);

    const slug = await uniqueTourSlug(input.slug ?? input.name);
    const submit = input.submit;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...tourProductData(input),
          slug,
          supplierId: user.supplierId!,
          status: submit ? "SUBMITTED" : "DRAFT",
          submittedAt: submit ? new Date() : null,
        },
        select: { id: true, name: true, slug: true, status: true },
      });
      await syncTourChildren(tx, created.id, input);
      return created;
    });

    await audit({
      user,
      action: submit ? "supplier.tour.submit" : "supplier.tour.create",
      entityType: "Product",
      entityId: product.id,
      summary: `${user.name} ${submit ? "submitted" : "created"} tour "${product.name}".`,
    });

    if (submit) {
      await notifyRole("ADMIN", {
        type: "SYSTEM",
        title: "New tour submitted for review",
        body: product.name,
        link: "/admin",
      });
    }

    return jsonOk({ tour: product }, { status: 201 });
  });
}
