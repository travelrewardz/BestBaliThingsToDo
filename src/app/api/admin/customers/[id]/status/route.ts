import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]) });

/** POST /api/admin/customers/[id]/status — activate / suspend a customer account. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { status } = await parseJson(req, schema);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (!existing) throw new ApiError(404, "Customer not found", "not_found");
    if (existing.role !== "CUSTOMER") {
      throw new ApiError(400, "Only customer accounts can be managed here", "validation");
    }

    const customer = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    });

    await audit({
      user,
      action: `admin.customer.${status.toLowerCase()}`,
      entityType: "User",
      entityId: customer.id,
      summary: `${user.name} set customer ${customer.email} to ${status}.`,
      before: { status: existing.status },
      after: { status },
    });

    return jsonOk({ customer });
  });
}
