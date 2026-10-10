import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

export const agentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  commissionBps: z.number().int().min(0).max(10_000).default(1000),
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED"]).default("ACTIVE"),
  notes: z.string().trim().max(2000).optional(),
});

const orNull = (v: string | undefined) => (v ? v : null);

/** POST /api/admin/agents — create a B2B agent. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, agentSchema);
    const email = body.email.trim().toLowerCase();

    const existing = await prisma.agent.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ApiError(409, "An agent with that email already exists", "duplicate");

    const agent = await prisma.agent.create({
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
      action: "admin.agent.create",
      entityType: "Agent",
      entityId: agent.id,
      summary: `${user.name} added agent "${agent.name}" (${agent.email}).`,
    });

    return jsonOk({ agent }, { status: 201 });
  });
}
