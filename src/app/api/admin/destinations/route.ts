import { handle, jsonOk, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/tour-schema";
import { z } from "zod";

export const destinationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  region: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  intro: z.string().trim().max(4000).optional(),
  heroImage: z.string().trim().max(500).optional(),
  image: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

const orNull = (v: string | undefined) => (v ? v : null);

export async function uniqueDestinationSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; ; i++) {
    const found = await prisma.destination.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === excludeId) break;
    slug = `${root}-${i}`.slice(0, 70);
  }
  return slug;
}

/** POST /api/admin/destinations — create a destination. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const body = await parseJson(req, destinationSchema);
    const slug = await uniqueDestinationSlug(body.slug ?? body.name);

    const destination = await prisma.destination.create({
      data: {
        name: body.name,
        slug,
        region: orNull(body.region),
        description: orNull(body.description),
        intro: orNull(body.intro),
        heroImage: orNull(body.heroImage),
        image: orNull(body.image),
        sortOrder: body.sortOrder,
        active: body.active,
      },
      select: { id: true, name: true, slug: true },
    });

    await audit({
      user,
      action: "admin.destination.create",
      entityType: "Destination",
      entityId: destination.id,
      summary: `${user.name} created destination "${destination.name}".`,
    });

    return jsonOk({ destination }, { status: 201 });
  });
}
