import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { cmsPageSchema, uniquePageSlug } from "../route";

/** PATCH /api/admin/pages/[id] — update a CMS page. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, cmsPageSchema);

    const existing = await prisma.page.findUnique({ where: { id }, select: { id: true, slug: true, title: true, status: true } });
    if (!existing) throw new ApiError(404, "Page not found", "not_found");

    const slug = body.slug && body.slug !== existing.slug
      ? await uniquePageSlug(body.slug, existing.id)
      : existing.slug;

    const page = await prisma.page.update({
      where: { id },
      data: { title: body.title, slug, content: body.content, status: body.status },
      select: { id: true, title: true, slug: true, status: true },
    });

    await audit({
      user,
      action: "admin.page.update",
      entityType: "Page",
      entityId: page.id,
      summary: `${user.name} updated page "${page.title}".`,
      before: { title: existing.title, slug: existing.slug, status: existing.status },
      after: { title: page.title, slug: page.slug, status: page.status },
    });

    return jsonOk({ page });
  });
}

/** DELETE /api/admin/pages/[id] — delete a CMS page. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });

    const existing = await prisma.page.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!existing) throw new ApiError(404, "Page not found", "not_found");

    await prisma.page.delete({ where: { id } });

    await audit({
      user,
      action: "admin.page.delete",
      entityType: "Page",
      entityId: id,
      summary: `${user.name} deleted page "${existing.title}".`,
    });

    return jsonOk({ ok: true });
  });
}
