import { handle, jsonOk, ApiError, parseJson, requireApiUser, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifyRole } from "@/lib/notifications";
import { slugify } from "@/lib/tour-schema";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  /** CATEGORY = homepage tiles, ACTIVITY = /activity/ pages; suppliers can add either. */
  kind: z.enum(["CATEGORY", "ACTIVITY"]).default("CATEGORY"),
});

/** Slug unique across ALL categories (the DB constraint on slug is global). */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; ; i++) {
    const found = await prisma.category.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!found) break;
    slug = `${root}-${i}`.slice(0, 70);
  }
  return slug;
}

/**
 * POST /api/supplier/categories — let a supplier add a category or activity from
 * the tour form's Destinations & categories section.
 * Reuses an existing row when the name already matches (case-insensitive) within
 * the same kind, otherwise creates a new active row and pings the admins to review it.
 */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["SUPPLIER"] });
    if (!user.supplierId) throw new ApiError(403, "No supplier profile on this account", "no_supplier");
    rateLimit(`supplier-category:${user.id}`, 15, 60_000);

    const body = await parseJson(req, createCategorySchema);
    const name = body.name.trim();
    const kind = body.kind;
    const label = kind === "ACTIVITY" ? "activity" : "category";

    const existing = await prisma.category.findFirst({
      where: { kind, name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, active: true },
    });
    if (existing) {
      return jsonOk({ category: existing, created: false });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug: await uniqueSlug(name),
        kind,
        active: true,
      },
      select: { id: true, name: true, slug: true, active: true },
    });

    await audit({
      user,
      action: `supplier.${label}.create`,
      entityType: "Category",
      entityId: category.id,
      summary: `${user.name} added ${label} "${category.name}".`,
    });

    await notifyRole("ADMIN", {
      type: "SYSTEM",
      title: `New ${label} added by a supplier`,
      body: `${category.name} — added by ${user.name}`,
      link: "/admin/destinations",
    });

    return jsonOk({ category, created: true }, { status: 201 });
  });
}
