import { NextResponse } from "next/server";
import { logError, logger } from "@/lib/logger";
import {
  getSessionUser,
  resolveUserFromToken,
  tokenFromRequest,
  canAny,
  type SessionUser,
} from "@/lib/auth";
import { env } from "@/lib/env";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = "error", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers || {}) },
  });
}

export function jsonError(
  status: number,
  message: string,
  code = "error",
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { message, code, details } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

/**
 * CSRF defence-in-depth:
 *  1. Session cookies are SameSite=Lax (browser never sends them on
 *     cross-site POST/PUT/PATCH/DELETE).
 *  2. When a browser DOES send an Origin header on a mutation, it must
 *     match APP_URL.
 */
export function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client (curl, server-to-server)
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Invalid request origin", "csrf");
  }
  const appHost = new URL(env.appUrl).host;
  if (originHost !== appHost) {
    throw new ApiError(403, "Cross-origin request blocked", "csrf");
  }
}

/** In-memory sliding-window rate limiter (single instance). */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) {
      // drop expired entries to bound memory
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, "Too many requests, please try again shortly", "rate_limited");
  }
}

export type ApiCtx = { params?: Record<string, string> };

/**
 * Wraps a route handler: same-origin check, structured error responses,
 * central error logging.
 */
export function handle<Req extends Request, Res>(
  req: Req,
  fn: (req: Req) => Promise<Res>
): Promise<Res | NextResponse> {
  return (async () => {
    try {
      assertSameOrigin(req);
      return await fn(req);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status >= 500) logError(err, { url: req.url });
        return jsonError(err.status, err.message, err.code, err.details);
      }
      logError(err, { url: req.url, method: req.method });
      return jsonError(500, "Something went wrong. Please try again.", "server_error");
    }
  })();
}

/** Authenticated API user (cookie session). Throws 401 when missing. */
export async function requireApiUser(
  req: Request,
  opts: { roles?: string[]; permissions?: string[] } = {}
): Promise<SessionUser> {
  const user = await resolveUserFromToken(tokenFromRequest(req));
  if (!user) throw new ApiError(401, "Authentication required", "unauthenticated");
  if (opts.roles && !opts.roles.includes(user.role)) {
    throw new ApiError(403, "You do not have access to this resource", "forbidden");
  }
  if (opts.permissions?.length) {
    const ok = await canAny(user, opts.permissions);
    if (!ok) throw new ApiError(403, "Missing permission", "forbidden");
  }
  return user;
}

/** Server-component session user or null (no throw). */
export async function optionalUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function requirePageUser(roles: string[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED") as Error & { digest?: string };
    err.digest = "UNAUTHENTICATED";
    throw err;
  }
  if (!roles.includes(user.role)) {
    const err = new Error("FORBIDDEN") as Error & { digest?: string };
    err.digest = "FORBIDDEN";
    throw err;
  }
  return user;
}

/** Parses the JSON body without validation. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error("invalid");
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body", "invalid_body");
  }
}

/** Parses + validates the JSON body with a zod schema (400 on failure). */
export async function parseJson<S extends import("zod").ZodType>(
  req: Request,
  schema: S
): Promise<import("zod").infer<S>> {
  const body = await readJson(req);
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    throw new ApiError(400, `${where}${issue?.message ?? "Invalid input"}`, "validation");
  }
  return result.data;
}

export { logger };
