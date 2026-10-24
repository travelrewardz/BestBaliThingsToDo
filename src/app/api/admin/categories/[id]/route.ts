import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { parseStringList } from "@/lib/tours";
import { categorySchema, uniqueCategorySlug } from "../route";

const orNull = (v: string | undefined) => (v ? v : null);

/** How many distinct tours reference this category (legacy single link + multi link). */
async function tourUsage(id: string): Promise<number> {
  const [direct, linked] = await Promise.all([
    prisma.product.findMany({ where: { categoryId: id }, select: { id: true } }),
    prisma.product.findMany({
      where: { categoryLinks: { contains: id } },
      select: { id: true, categoryLinks: true },
    }),
  ]);
  const tours = new Set(direct.map((p) => p.id));
  for (const product of linked) {
    if (parseStringList(product.categoryLinks).includes(id)) tours.add(product.id);
  }
  return tours.size;
}

/** PATCH /api/admin/categories/[id] — update a category. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, categorySchema);

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true },
    });
    if (!existing) throw new ApiError(404, "Category not found", "not_found");

    const slug =
      body.slug && body.slug !== existing.slug
        ? await uniqueCategorySlug(body.slug, existing.id)
        : existing.slug;

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        kind: body.kind,
        description: orNull(body.description),
        image: orNull(body.image),
        icon: orNull(body.icon),
        sortOrder: body.sortOrder,
        active: body.active,
      },
      select: { id: true, name: true, slug: true },
    });

    await audit({
      user,
      action: "admin.category.update",
      entityType: "Category",
      entityId: id,
      summary: `${user.name} updated category "${category.name}".`,
    });

    return jsonOk({ category });
  });
}

/** DELETE /api/admin/categories/[id] — delete a category no tour or child uses. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new ApiError(404, "Category not found", "not_found");

    const children = await prisma.category.count({ where: { parentId: id } });
    if (children > 0) {
      throw new ApiError(409, `This category has ${children} subcategorie(s). Remove them first.`, "in_use");
    }

    const tours = await tourUsage(id);
    if (tours > 0) {
      throw new ApiError(409, `This category is used by ${tours} tour(s). Deactivate it instead.`, "in_use");
    }

    await prisma.category.delete({ where: { id } });
    await audit({
      user,
      action: "admin.category.delete",
      entityType: "Category",
      entityId: id,
      summary: `${user.name} deleted category "${existing.name}".`,
    });
    return jsonOk({ deleted: true });
  });
}
