import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ active: z.boolean() });

/** PATCH /api/admin/banners/[id] — activate / deactivate a banner. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { active } = await parseJson(req, schema);

    const existing = await prisma.banner.findUnique({ where: { id }, select: { id: true, title: true, active: true } });
    if (!existing) throw new ApiError(404, "Banner not found", "not_found");

    const banner = await prisma.banner.update({ where: { id }, data: { active }, select: { id: true, title: true, active: true } });

    await audit({
      user,
      action: `admin.banner.${active ? "activate" : "deactivate"}`,
      entityType: "Banner",
      entityId: banner.id,
      summary: `${user.name} ${active ? "activated" : "deactivated"} banner "${banner.title}".`,
      before: { active: existing.active },
      after: { active },
    });

    return jsonOk({ banner });
  });
}
