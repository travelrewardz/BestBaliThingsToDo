import { handle, jsonOk, ApiError, parseJson, rateLimit, getIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashToken, hashPassword } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain a number"),
});

export async function POST(req: Request) {
  return handle(req, async (req) => {
    rateLimit(`reset:${getIp(req)}`, 10, 60_000);
    const body = await parseJson(req, schema);

    const reset = await prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(body.token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new ApiError(400, "This reset link is invalid or has expired", "invalid_token");
    }

    await prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(body.password) },
    });
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });
    // Invalidate all sessions for safety
    await prisma.session.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return jsonOk({ ok: true, message: "Password updated — you can sign in now." });
  });
}
