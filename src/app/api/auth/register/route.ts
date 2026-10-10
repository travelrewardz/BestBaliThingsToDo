import { handle, jsonOk, ApiError, parseJson, rateLimit, getIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, randomToken, signValue } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain a number"),
  phone: z.string().max(30).optional(),
});

export async function POST(req: Request) {
  return handle(req, async (req) => {
    rateLimit(`register:${getIp(req)}`, 5, 60_000);
    const body = await parseJson(req, schema);
    const email = body.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "An account with this email already exists", "exists");

    const customerRole = await prisma.role.findUnique({ where: { name: "customer" } });
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        phone: body.phone || null,
        passwordHash: await hashPassword(body.password),
        role: "CUSTOMER",
        roleId: customerRole?.id ?? null,
        status: "ACTIVE",
        emailVerifiedAt: null,
      },
    });

    // Verification link (signed, 24h) — logged to the outbox in development.
    const token = signValue(`verify:${user.id}`, 60 * 24);
    await sendEmail({
      to: email,
      toUserId: user.id,
      template: "welcome",
      vars: { name: user.name, email },
    });
    await sendEmail({
      to: email,
      toUserId: user.id,
      template: "verifyEmail",
      vars: { name: user.name, token },
    });
    void randomToken; // kept for symmetry with other auth flows

    await createSession(user.id, {
      ip: getIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk({ user: { id: user.id, email, name: user.name, role: "CUSTOMER" }, redirect: "/account" });
  });
}
