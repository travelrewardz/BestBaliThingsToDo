import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { UserRole } from "@/lib/enums";

export const SESSION_COOKIE = "btd_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleId: string | null;
  status: string;
  supplierId?: string | null;
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", env.authSecret).update(token).digest("hex");
}

/** Constant-time comparison for voucher/verify codes. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Signed, expiring token used in email links (password reset). */
export function signValue(value: string, ttlMinutes = 60): string {
  const exp = Date.now() + ttlMinutes * 60_000;
  const payload = Buffer.from(`${value}.${exp}`).toString("base64url");
  const sig = crypto
    .createHmac("sha256", env.authSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySignedValue(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac("sha256", env.authSecret)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  const raw = Buffer.from(payload, "base64url").toString("utf8");
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const value = raw.slice(0, dot);
  const exp = Number(raw.slice(dot + 1));
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return value;
}

/** Creates a DB-backed session and sets the httpOnly cookie. Route handlers / server actions only. */
export async function createSession(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 300) ?? null,
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
  return null;
}

async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { supplier: { select: { id: true, status: true } } } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status === "SUSPENDED") return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    roleId: u.roleId,
    status: u.status,
    supplierId: u.supplier?.id ?? null,
  };
}

/** Current session user from the request cookie (route handlers & server components). */
export async function resolveUserFromToken(token: string | null): Promise<SessionUser | null> {
  return userFromToken(token);
}

/** Current session user inside server components. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  return userFromToken(cookieStore.get(SESSION_COOKIE)?.value);
});

export type PermissionRow = { permission: { code: string } };

/**
 * Role → permission check. The admin role is seeded with code "*" which
 * grants everything (super admin).
 */
export const can = cache(
  async (user: SessionUser | null, code: string): Promise<boolean> => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (!user.roleId) return false;
    const rows = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: { permission: { select: { code: true } } },
      take: 200,
    });
    const codes = rows.map((r) => r.permission.code);
    return codes.includes("*") || codes.includes(code);
  }
);

export const canAny = cache(
  async (user: SessionUser | null, codes: string[]): Promise<boolean> => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (!user.roleId) return false;
    const rows = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: { permission: { select: { code: true } } },
      take: 200,
    });
    const granted = rows.map((r) => r.permission.code);
    if (granted.includes("*")) return true;
    return codes.some((c) => granted.includes(c));
  }
);
