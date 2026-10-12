import { handle, jsonOk, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/tour-schema";
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  kind: z.enum(["CATEGORY", "ACTIVITY"]).default("CATEGORY"),
  description: z.string().trim().max(2000).optional(),
  image: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

const orNull = (v: string | undefined) => (v ? v : null);

/** Slug unique within the category kind (CATEGORY / ACTIVITY). */
export async function uniqueCategorySlug(base: string, kind: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; ; i++) {
    const found = await prisma.category.findFirst({ where: { slug, kind }, select: { id: true } });
    if (!found || found.id === excludeId) break;
    slug = `${root}-${i}`.slice(0, 70);
  }
  return slug;
}

/** POST /api/admin/categories — create a category. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, categorySchema);
    const slug = await uniqueCategorySlug(body.slug ?? body.name, body.kind);

    const category = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        kind: body.kind,
        description: orNull(body.description),
        image: orNull(body.image),
        icon: orNull(body.icon),
        sortOrder: body.sortOrder,
        active: body.active,
      },
      select: { id: true, name: true, slug: true },
    });

    await audit({
      user,
      action: "admin.category.create",
      entityType: "Category",
      entityId: category.id,
      summary: `${user.name} created category "${category.name}".`,
    });

    return jsonOk({ category }, { status: 201 });
  });
}
