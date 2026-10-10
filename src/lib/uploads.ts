import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
  "application/pdf": [".pdf"],
};

export class UploadError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
  }
}

export function slugifyFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image"
  );
}

/**
 * Validates and stores an uploaded file under /public/uploads/YYYY/MM/.
 * Returns the public URL. Rejects oversized files, disallowed MIME types
 * and path tricks.
 */
export async function saveUpload(
  file: File,
  opts: { kind?: "image" | "document"; subdir?: string } = {}
): Promise<{ url: string; fileName: string; sizeBytes: number; mimeType: string }> {
  if (!file || typeof file === "string") throw new UploadError("No file provided");
  const maxSize = opts.kind === "document" ? 5 * 1024 * 1024 : 4 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new UploadError(
      `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`
    );
  }
  const type = file.type;
  const allowedTypes = opts.kind === "document" ? ["application/pdf"] : Object.keys(ALLOWED);
  if (!allowedTypes.includes(type)) {
    throw new UploadError("File type not allowed");
  }
  const exts = ALLOWED[type];
  const original = file.name || "upload";
  const ext = path.extname(original).toLowerCase();
  if (!exts.includes(ext)) throw new UploadError("File extension not allowed");

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dirRel = opts.subdir
    ? `${opts.subdir}/${yyyy}/${mm}`
    : `${yyyy}/${mm}`;
  const dirAbs = path.join(process.cwd(), "public", "uploads", dirRel);
  await fs.mkdir(dirAbs, { recursive: true });

  const base = slugifyFileName(original);
  const unique = crypto.randomBytes(4).toString("hex");
  const fileName = `${base}-${unique}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  // Basic content sniff: images must start with a known signature.
  if (type.startsWith("image/") && type !== "image/svg+xml" && !isImageBuffer(buf, type)) {
    throw new UploadError("File content does not match its type");
  }

  await fs.writeFile(path.join(dirAbs, fileName), buf);
  return {
    url: `/uploads/${dirRel}/${fileName}`,
    fileName,
    sizeBytes: file.size,
    mimeType: type,
  };
}

function isImageBuffer(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const gif = buf.toString("ascii", 0, 3) === "GIF";
  const riff = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  if (mime === "image/jpeg") return jpeg;
  if (mime === "image/png") return png;
  if (mime === "image/gif") return gif;
  if (mime === "image/webp") return riff;
  if (mime === "image/avif") return buf.toString("ascii", 4, 12).includes("ftyp");
  return jpeg || png || gif || riff;
}
