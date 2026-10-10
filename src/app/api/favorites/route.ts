import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ productId: z.string().min(1) });

/** POST /api/favorites — toggle a product in the user's favorites. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { permissions: ["customer.favorite.manage"] });
    const body = await parseJson(req, schema);

    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) throw new ApiError(404, "Tour not found", "not_found");

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: user.id, productId: body.productId } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return jsonOk({ favorited: false });
    }
    await prisma.favorite.create({ data: { userId: user.id, productId: body.productId } });
    return jsonOk({ favorited: true });
  });
}

/** GET /api/favorites — current user's favorites. */
export async function GET(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { permissions: ["customer.favorite.manage"] });
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: {
            media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
            destination: true,
            supplier: { select: { companyName: true } },
          },
        },
      },
    });
    return jsonOk({ favorites });
  });
}
