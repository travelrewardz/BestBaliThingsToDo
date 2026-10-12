import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ active: z.boolean() });

/** PATCH /api/admin/menus/[id] — activate / deactivate a menu item. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { active } = await parseJson(req, schema);

    const existing = await prisma.menu.findUnique({ where: { id }, select: { id: true, title: true, active: true } });
    if (!existing) throw new ApiError(404, "Menu item not found", "not_found");

    const menu = await prisma.menu.update({ where: { id }, data: { active }, select: { id: true, title: true, active: true } });

    await audit({
      user,
      action: `admin.menu.${active ? "activate" : "deactivate"}`,
      entityType: "Menu",
      entityId: menu.id,
      summary: `${user.name} ${active ? "activated" : "deactivated"} menu item "${menu.title}".`,
      before: { active: existing.active },
      after: { active },
    });

    return jsonOk({ menu });
  });
}
