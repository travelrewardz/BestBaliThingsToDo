import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { agentSchema } from "../route";

const orNull = (v: string | undefined) => (v ? v : null);

/** PATCH /api/admin/agents/[id] — update an agent. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, agentSchema);
    const email = body.email.trim().toLowerCase();

    const existing = await prisma.agent.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) throw new ApiError(404, "Agent not found", "not_found");

    const clash = await prisma.agent.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== id) throw new ApiError(409, "Another agent already uses that email", "duplicate");

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        name: body.name,
        company: orNull(body.company),
        email,
        phone: orNull(body.phone),
        country: orNull(body.country),
        commissionBps: body.commissionBps,
        status: body.status,
        notes: orNull(body.notes),
      },
      select: { id: true, name: true, email: true },
    });

    await audit({
      user,
      action: "admin.agent.update",
      entityType: "Agent",
      entityId: agent.id,
      summary: `${user.name} updated agent "${agent.name}".`,
    });

    return jsonOk({ agent });
  });
}

/** DELETE /api/admin/agents/[id] — remove an agent. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const existing = await prisma.agent.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) throw new ApiError(404, "Agent not found", "not_found");
    await prisma.agent.delete({ where: { id } });
    await audit({
      user,
      action: "admin.agent.delete",
      entityType: "Agent",
      entityId: id,
      summary: `${user.name} deleted agent "${existing.name}".`,
    });
    return jsonOk({ deleted: true });
  });
}
