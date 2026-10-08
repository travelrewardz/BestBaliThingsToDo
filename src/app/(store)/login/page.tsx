import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "SUPPLIER" ? "/supplier" : "/account");
  return (
    <div className="bg-sand-50 px-4 py-14">
      <Suspense>
        <AuthForm mode="login" title="Sign in to Bali Things To Do" subtitle="Book faster, manage bookings and save favorites." />
      </Suspense>
    </div>
  );
}
