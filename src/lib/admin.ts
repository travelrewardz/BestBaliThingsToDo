import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

/** Server guard for every page in the admin panel. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "SUPPLIER") redirect("/supplier");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

// Re-export the client-safe constants/helpers so server pages can import one module.
export * from "@/lib/admin-nav";
