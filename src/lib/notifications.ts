import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  adminChannel,
  broadcast,
  supplierChannel,
  userChannel,
} from "@/lib/sse";
import type { NotificationType } from "@/lib/enums";

export type NotifyInput = {
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string;
  link?: string;
};

/** Creates an in-app notification and pushes it over SSE immediately. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
    broadcast(userChannel(input.userId), "notification", {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt,
    });
  } catch (err) {
    logger.error("notify failed", { userId: input.userId, err: String(err) });
  }
}

export async function notifyMany(
  userIds: string[],
  data: Omit<NotifyInput, "userId">
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...data, userId })));
}

/** Notifies every user holding a role (e.g. all admins). */
export async function notifyRole(
  role: "ADMIN" | "SUPPLIER" | "CUSTOMER",
  data: Omit<NotifyInput, "userId">
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role, status: "ACTIVE" },
    select: { id: true },
  });
  await notifyMany(users.map((u) => u.id), data);
}

export async function notifySupplier(
  supplierId: string,
  data: Omit<NotifyInput, "userId">
): Promise<void> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { userId: true },
  });
  if (!supplier) return;
  await notify({ ...data, userId: supplier.userId });
  broadcast(supplierChannel(supplierId), "notification", data);
}

/** Generic realtime event to dashboards (booking status, availability, stats). */
export function pushRealtime(
  scope: { admin?: boolean; supplierId?: string; userId?: string },
  event: string,
  data: unknown
): void {
  if (scope.admin) broadcast(adminChannel, event, data);
  if (scope.supplierId) broadcast(supplierChannel(scope.supplierId), event, data);
  if (scope.userId) broadcast(userChannel(scope.userId), event, data);
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
