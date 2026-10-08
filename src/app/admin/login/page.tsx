import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "ADMIN") redirect("/admin");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 py-10">
      <Link href="/" className="mb-6 text-2xl font-bold text-white">
        🌴 Bali Things To Do
      </Link>
      <Suspense>
        <AuthForm
          mode="login"
          role="ADMIN"
          title="Admin panel"
          subtitle="Manage suppliers, tours, bookings, finance and content."
        />
      </Suspense>
      <p className="mt-4 text-xs text-slate-500">Unauthorised access is logged and prohibited.</p>
    </div>
  );
}
