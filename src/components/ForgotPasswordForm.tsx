"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Alert } from "@/components/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Something went wrong");
      } else setSent(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send you a reset link (valid for 60 minutes).
      </p>
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      {sent ? (
        <div className="mt-4"><Alert tone="success">If that email exists, a reset link is on its way. Check your inbox (and spam folder).</Alert></div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

function ResetInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error?.message || "Something went wrong");
      else setDone(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (!token) {
    return <Alert tone="error">This reset link is missing its token. Request a new one.</Alert>;
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      {done ? (
        <div className="mt-4">
          <Alert tone="success">Password updated — you can sign in now.</Alert>
          <div className="mt-4"><ButtonLinkInline href="/login" /></div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}

function ButtonLinkInline({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex w-full items-center justify-center rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
      Sign in
    </Link>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
