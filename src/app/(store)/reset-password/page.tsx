import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Set new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <div className="bg-sand-50 px-4 py-14">
      <ResetPasswordForm />
    </div>
  );
}
