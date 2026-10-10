import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["PENDING", "APPROVED", "HIDDEN", "FLAGGED"]),
  note: z.string().trim().max(1000).optional(),
});

/** POST /api/admin/reviews/[id]/status — approve / hide / flag a review. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { status, note } = await parseJson(req, schema);

    const existing = await prisma.review.findUnique({ where: { id }, select: { id: true, status: true, title: true } });
    if (!existing) throw new ApiError(404, "Review not found", "not_found");

    const review = await prisma.review.update({
      where: { id },
      data: { status, adminNote: note ?? null },
      select: { id: true, status: true },
    });

    await audit({
      user,
      action: `admin.review.${status.toLowerCase()}`,
      entityType: "Review",
      entityId: review.id,
      summary: `${user.name} set a review to ${status}.`,
      before: { status: existing.status },
      after: { status },
    });

    return jsonOk({ review });
  });
}
