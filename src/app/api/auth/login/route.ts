import { handle, jsonOk, ApiError, parseJson, rateLimit, getIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["ADMIN", "SUPPLIER", "CUSTOMER"]).optional(),
});

export async function POST(req: Request) {
  return handle(req, async (req) => {
    rateLimit(`login:${getIp(req)}`, 10, 60_000); // 10 attempts / minute / IP
    const body = await parseJson(req, schema);

    const user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      include: { supplier: { select: { id: true, status: true } } },
    });
    // Same generic error whether the user exists or not (no enumeration).
    const invalid = new ApiError(401, "Invalid email or password", "invalid_credentials");
    if (!user) throw invalid;
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw invalid;
    if (user.status === "SUSPENDED") {
      throw new ApiError(403, "This account has been suspended. Contact support.", "suspended");
    }
    if (body.role && user.role !== body.role) {
      throw new ApiError(
        403,
        body.role === "ADMIN"
          ? "This account cannot access the admin panel"
          : body.role === "SUPPLIER"
            ? "This account is not a supplier account"
            : "Invalid account type",
        "wrong_role"
      );
    }
    if (user.role === "SUPPLIER" && user.supplier?.status === "PENDING") {
      // allow login but surface pending state
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id, {
      ip: getIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const home =
      user.role === "ADMIN" ? "/admin" : user.role === "SUPPLIER" ? "/supplier" : "/account";
    return jsonOk({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      redirect: home,
    });
  });
}
