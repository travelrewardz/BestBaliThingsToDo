import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth";

export type AuditInput = {
  user?: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Records "who changed what, when, from where".
 * The summary is a human sentence, e.g.
 *   "Admin John changed ATV price from $45 to $50 on 7 October 2026."
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.user?.id ?? null,
        actorLabel: input.user
          ? `${input.user.name} (${input.user.role})`
          : "system",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        before: input.before === undefined ? null : JSON.stringify(input.before),
        after: input.after === undefined ? null : JSON.stringify(input.after),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    logger.error("audit write failed", { action: input.action, err: String(err) });
  }
}

export function formatWhen(d = new Date()): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
