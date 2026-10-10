import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["APPROVED", "PENDING", "SUSPENDED", "REJECTED", "INACTIVE", "ACTIVE"]),
  reason: z.string().trim().max(1000).optional(),
});

/** POST /api/admin/suppliers/[id]/status — approve / suspend / reject a supplier. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { status, reason } = await parseJson(req, schema);

    const existing = await prisma.supplier.findUnique({
      where: { id },
      select: { id: true, companyName: true, status: true, userId: true },
    });
    if (!existing) throw new ApiError(404, "Supplier not found", "not_found");

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        status,
        approvedAt: status === "APPROVED" || status === "ACTIVE" ? new Date() : undefined,
        rejectedReason: status === "REJECTED" ? (reason ?? null) : null,
      },
      select: { id: true, companyName: true, status: true },
    });

    await audit({
      user,
      action: `admin.supplier.${status.toLowerCase()}`,
      entityType: "Supplier",
      entityId: supplier.id,
      summary: `${user.name} set supplier "${supplier.companyName}" to ${status}${reason ? ` (reason: ${reason})` : ""}.`,
      before: { status: existing.status },
      after: { status },
    });

    await notify({
      userId: existing.userId,
      type: "SYSTEM",
      title: `Supplier account ${status.replaceAll("_", " ").toLowerCase()}`,
      body: reason ?? supplier.companyName,
      link: "/supplier",
    });

    return jsonOk({ supplier });
  });
}
