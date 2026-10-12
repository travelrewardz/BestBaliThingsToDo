import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { faqSchema } from "../route";

/** PATCH /api/admin/faqs/[id] — update an FAQ entry. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, faqSchema);

    const existing = await prisma.faq.findUnique({ where: { id }, select: { id: true, question: true } });
    if (!existing) throw new ApiError(404, "FAQ not found", "not_found");

    const faq = await prisma.faq.update({
      where: { id },
      data: {
        scope: body.scope,
        scopeId: body.scopeId ?? null,
        question: body.question,
        answer: body.answer,
        sortOrder: body.sortOrder,
        active: body.active,
      },
      select: { id: true, question: true, scope: true, active: true },
    });

    await audit({
      user,
      action: "admin.faq.update",
      entityType: "Faq",
      entityId: faq.id,
      summary: `${user.name} updated FAQ "${faq.question}".`,
      before: { question: existing.question },
      after: { question: faq.question },
    });

    return jsonOk({ faq });
  });
}

/** DELETE /api/admin/faqs/[id] — delete an FAQ entry. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });

    const existing = await prisma.faq.findUnique({ where: { id }, select: { id: true, question: true } });
    if (!existing) throw new ApiError(404, "FAQ not found", "not_found");

    await prisma.faq.delete({ where: { id } });

    await audit({
      user,
      action: "admin.faq.delete",
      entityType: "Faq",
      entityId: id,
      summary: `${user.name} deleted FAQ "${existing.question}".`,
    });

    return jsonOk({ ok: true });
  });
}
