import type { Metadata } from "next";
import { VerifyEmailButton } from "@/components/VerifyEmailButton";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="bg-sand-50 px-4 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="text-4xl">✉️</div>
        <h1 className="mt-3 font-display text-2xl font-bold">Confirm your email</h1>
        <p className="mt-2 text-sm text-slate-500">
          Click the button below to verify your email address and activate your account.
        </p>
        <div className="mt-5">
          <VerifyEmailButton token={token || ""} />
        </div>
      </div>
    </div>
  );
}
