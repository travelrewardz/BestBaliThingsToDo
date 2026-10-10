import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { destinationSchema, uniqueDestinationSlug } from "../route";

const orNull = (v: string | undefined) => (v ? v : null);

/** PATCH /api/admin/destinations/[id] — update a destination. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, destinationSchema);

    const existing = await prisma.destination.findUnique({ where: { id }, select: { id: true, slug: true, name: true } });
    if (!existing) throw new ApiError(404, "Destination not found", "not_found");

    const slug = body.slug && body.slug !== existing.slug
      ? await uniqueDestinationSlug(body.slug, existing.id)
      : existing.slug;

    const destination = await prisma.destination.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        region: orNull(body.region),
        description: orNull(body.description),
        intro: orNull(body.intro),
        heroImage: orNull(body.heroImage),
        image: orNull(body.image),
        sortOrder: body.sortOrder,
        active: body.active,
      },
      select: { id: true, name: true, slug: true },
    });

    await audit({
      user,
      action: "admin.destination.update",
      entityType: "Destination",
      entityId: destination.id,
      summary: `${user.name} updated destination "${destination.name}".`,
    });

    return jsonOk({ destination });
  });
}

/** DELETE /api/admin/destinations/[id] — delete a destination with no tours. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });

    const existing = await prisma.destination.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) throw new ApiError(404, "Destination not found", "not_found");

    const tours = await prisma.product.count({ where: { destinationId: id } });
    if (tours > 0) {
      throw new ApiError(409, `This destination is used by ${tours} tour(s). Deactivate it instead.`, "in_use");
    }

    await prisma.destination.delete({ where: { id } });
    await audit({
      user,
      action: "admin.destination.delete",
      entityType: "Destination",
      entityId: id,
      summary: `${user.name} deleted destination "${existing.name}".`,
    });
    return jsonOk({ deleted: true });
  });
}
