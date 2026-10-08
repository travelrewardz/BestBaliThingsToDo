import { handle, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { markAllRead } from "@/lib/notifications";

/** GET /api/notifications — recent notifications for the signed-in user. */
export async function GET(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req);
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return jsonOk({ items, unread });
  });
}

/** PATCH /api/notifications — mark all of the user's notifications read. */
export async function PATCH(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req);
    await markAllRead(user.id);
    return jsonOk({ ok: true });
  });
}
