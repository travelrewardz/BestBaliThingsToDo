import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Supplier sign in", robots: { index: false } };

export default async function SupplierLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "SUPPLIER") redirect("/supplier");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-4 py-10">
      <Link href="/" className="mb-6 text-2xl font-bold text-white">
        🌴 Bali Things To Do — Supplier Portal
      </Link>
      <Suspense>
        <AuthForm
          mode="login"
          role="SUPPLIER"
          title="Supplier sign in"
          subtitle="Manage your tours, availability, bookings and payouts."
        />
      </Suspense>
      <p className="mt-5 text-sm text-brand-200">
        Not a supplier yet?{" "}
        <Link href="/supplier/register" className="font-semibold text-sunset-400 underline">
          Apply to sell on our marketplace
        </Link>
      </p>
    </div>
  );
}
