import { handle, jsonOk, ApiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * DELETE /api/admin/media/[id] — remove a media record and, where possible,
 * its backing file (local disk or Vercel Blob). Database-stored bytes are
 * removed together with the row.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["ADMIN"] });

    const media = await prisma.media.findUnique({
      where: { id },
      select: { id: true, url: true, fileName: true, sizeBytes: true },
    });
    if (!media) throw new ApiError(404, "Media not found", "not_found");

    await prisma.media.delete({ where: { id } });

    // Best-effort removal of the backing file (row is already gone).
    if (media.url.startsWith("/uploads/")) {
      await fs
        .rm(path.join(process.cwd(), "public", media.url), { force: true })
        .catch(() => undefined);
    } else if (media.url.includes(".blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import("@vercel/blob");
      await del(media.url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    }

    await audit({
      user,
      action: "admin.media.delete",
      entityType: "Media",
      entityId: media.id,
      summary: `${user.name} deleted media "${media.fileName}" (${media.sizeBytes} bytes).`,
    });

    return jsonOk({ ok: true });
  });
}
