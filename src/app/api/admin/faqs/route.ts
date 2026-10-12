import { handle, jsonOk, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

export const faqSchema = z.object({
  scope: z.enum(["SITE", "PRODUCT", "DESTINATION", "CATEGORY", "BLOG"]).default("SITE"),
  scopeId: z.string().trim().max(80).optional(),
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(4000),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

/** POST /api/admin/faqs — create an FAQ entry. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, faqSchema);

    const faq = await prisma.faq.create({
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
      action: "admin.faq.create",
      entityType: "Faq",
      entityId: faq.id,
      summary: `${user.name} created FAQ "${faq.question}".`,
    });

    return jsonOk({ faq }, { status: 201 });
  });
}
