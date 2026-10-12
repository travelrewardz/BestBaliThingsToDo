import { handle, jsonOk, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/tour-schema";
import { z } from "zod";

export const cmsPageSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  content: z.string().max(100_000).default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export async function uniquePageSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "page";
  let slug = root;
  for (let i = 2; ; i++) {
    const found = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === excludeId) break;
    slug = `${root}-${i}`.slice(0, 70);
  }
  return slug;
}

/** POST /api/admin/pages — create a CMS page. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, cmsPageSchema);
    const slug = await uniquePageSlug(body.slug ?? body.title);

    const page = await prisma.page.create({
      data: { title: body.title, slug, content: body.content, status: body.status },
      select: { id: true, title: true, slug: true, status: true },
    });

    await audit({
      user,
      action: "admin.page.create",
      entityType: "Page",
      entityId: page.id,
      summary: `${user.name} created page "${page.title}".`,
    });

    return jsonOk({ page }, { status: 201 });
  });
}
