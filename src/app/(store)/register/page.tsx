import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/account");
  return (
    <div className="bg-sand-50 px-4 py-14">
      <Suspense>
        <AuthForm
          mode="register"
          title="Create your account"
          subtitle="Join to book tours, track bookings and write verified reviews."
        />
      </Suspense>
    </div>
  );
}
