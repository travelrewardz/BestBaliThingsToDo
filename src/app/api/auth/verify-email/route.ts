import { handle, jsonOk, ApiError, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifySignedValue } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ token: z.string().min(10) });

export async function POST(req: Request) {
  return handle(req, async (req) => {
    const { token } = await parseJson(req, schema);
    const value = verifySignedValue(token);
    if (!value || !value.startsWith("verify:")) {
      throw new ApiError(400, "This verification link is invalid or expired", "invalid_token");
    }
    const userId = value.slice("verify:".length);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "Account not found", "not_found");
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    return jsonOk({ ok: true });
  });
}
