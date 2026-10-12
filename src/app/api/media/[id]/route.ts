import { prisma } from "@/lib/prisma";

/**
 * GET /api/media/[id] — serves image bytes stored in the database
 * (uploads made when no Vercel Blob store is configured).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const media = await prisma.media.findUnique({
    where: { id },
    select: { data: true, mimeType: true, fileName: true },
  });
  if (!media?.data) return new Response("Not found", { status: 404 });

  return new Response(media.data, {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${media.fileName}"`,
    },
  });
}
