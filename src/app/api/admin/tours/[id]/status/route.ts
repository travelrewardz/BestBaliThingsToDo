import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifySupplier } from "@/lib/notifications";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["PUBLISHED", "APPROVED", "CHANGES_REQUESTED", "REJECTED", "UNPUBLISHED", "IN_REVIEW"]),
  note: z.string().trim().max(2000).optional(),
});

/** POST /api/admin/tours/[id]/status — publish / approve / reject / request changes. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { status, note } = await parseJson(req, schema);

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, supplierId: true, status: true },
    });
    if (!existing) throw new ApiError(404, "Tour not found", "not_found");

    const now = new Date();
    const data: Record<string, unknown> = { status, adminNote: note ?? null };
    if (status === "PUBLISHED") {
      data.publishedAt = now;
      data.approvedAt = now;
    } else if (status === "APPROVED") {
      data.approvedAt = now;
    }

    const tour = await prisma.product.update({
      where: { id },
      data,
      select: { id: true, name: true, slug: true, status: true },
    });

    await audit({
      user,
      action: `admin.tour.${status.toLowerCase()}`,
      entityType: "Product",
      entityId: tour.id,
      summary: `${user.name} set tour "${tour.name}" to ${status}${note ? ` (note: ${note})` : ""}.`,
      before: { status: existing.status },
      after: { status },
    });

    await notifySupplier(existing.supplierId, {
      type: "SYSTEM",
      title: `Tour ${status.replaceAll("_", " ").toLowerCase()}`,
      body: tour.name,
      link: "/supplier/tours",
    });

    return jsonOk({ tour });
  });
}
