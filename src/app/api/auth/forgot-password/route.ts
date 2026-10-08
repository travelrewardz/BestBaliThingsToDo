import { handle, jsonOk, parseJson, rateLimit, getIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { randomToken, hashToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  return handle(req, async (req) => {
    rateLimit(`forgot:${getIp(req)}`, 5, 60_000);
    const { email } = await parseJson(req, schema);

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (user) {
      const token = randomToken();
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
        },
      });
      await sendEmail({
        to: user.email,
        toUserId: user.id,
        template: "passwordReset",
        vars: { name: user.name, token },
      });
    }
    // Always the same response — never reveals whether the email exists.
    return jsonOk({
      ok: true,
      message: "If that email exists, a password reset link has been sent.",
    });
  });
}
