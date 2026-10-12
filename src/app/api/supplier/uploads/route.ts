import { handle, jsonOk, ApiError, requireApiUser, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { saveUpload, validateUpload, UploadError } from "@/lib/uploads";

/**
 * POST /api/supplier/uploads (multipart/form-data: file, subdir?)
 * Stores an image from the supplier's device and returns its public URL.
 *
 * Storage backend:
 *  - BLOB_READ_WRITE_TOKEN set  → Vercel Blob (survives deploys, CDN-served)
 *  - production without a token → raw bytes in Postgres, served by /api/media/[id]
 *  - development                → public/uploads on local disk
 */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["SUPPLIER", "ADMIN"] });
    rateLimit(`uploads:${user.id}`, 60, 60_000);

    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "Expected multipart/form-data", "validation");

    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided", "validation");

    const subdirRaw = String(form.get("subdir") ?? "").trim().toLowerCase();
    const subdir = /^[a-z0-9][a-z0-9-]{0,39}$/.test(subdirRaw) ? subdirRaw : "misc";
    const alt = String(form.get("alt") ?? "").slice(0, 300);

    try {
      const databaseStorage = !process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV === "production";

      if (databaseStorage) {
        const v = await validateUpload(file, { kind: "image", subdir });
        const media = await prisma.media.create({
          data: {
            fileName: v.fileName,
            url: "pending",
            mimeType: v.mimeType,
            sizeBytes: v.sizeBytes,
            data: new Uint8Array(v.buf),
            alt,
            uploadedById: user.id,
          },
          select: { id: true },
        });
        const url = `/api/media/${media.id}`;
        await prisma.media.update({ where: { id: media.id }, data: { url } });
        return jsonOk({ id: media.id, url, fileName: v.fileName, sizeBytes: v.sizeBytes, mimeType: v.mimeType }, { status: 201 });
      }

      const saved = await saveUpload(file, { kind: "image", subdir });
      const media = await prisma.media.create({
        data: {
          fileName: saved.fileName,
          url: saved.url,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          alt,
          uploadedById: user.id,
        },
        select: { id: true },
      });
      return jsonOk({ id: media.id, ...saved }, { status: 201 });
    } catch (err) {
      if (err instanceof UploadError) throw new ApiError(err.status, err.message, "upload");
      throw err;
    }
  });
}
