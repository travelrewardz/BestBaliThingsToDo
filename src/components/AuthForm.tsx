"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Alert } from "@/components/ui";

type Props = {
  mode: "login" | "register";
  role?: "ADMIN" | "SUPPLIER" | "CUSTOMER";
  title?: string;
  subtitle?: string;
};

export function AuthForm({ mode, role = "CUSTOMER", title, subtitle }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email: form.email, password: form.password, role }
            : { name: form.name, email: form.email, password: form.password, phone: form.phone }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error?.message || "Something went wrong";
        // Staff accounts cannot sign in on the storefront — point them at the right portal.
        const hint =
          role === "CUSTOMER" && data?.error?.code === "wrong_role"
            ? " This is a staff account — sign in at /admin/login or /supplier/login instead."
            : "";
        setError(message + hint);
        setLoading(false);
        return;
      }
      const fallback = role === "ADMIN" ? "/admin" : role === "SUPPLIER" ? "/supplier" : "/account";
      router.push(next || data.redirect || fallback);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="font-display text-2xl font-bold">
        {title || (mode === "login" ? "Welcome back" : "Create your account")}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      {role === "ADMIN" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          🔐 Staff access — authorized personnel only
        </p>
      )}
      {role === "SUPPLIER" && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
          🏢 Supplier portal — manage your tours & bookings
        </p>
      )}

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "register" && (
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Full name *
            </label>
            <input
              id="name"
              required
              value={form.name}
              onChange={set("name")}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Sarah Mitchell"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Email *
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            placeholder="you@example.com"
          />
        </div>
        {mode === "register" && (
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Phone / WhatsApp (optional)
            </label>
            <input
              id="phone"
              value={form.phone}
              onChange={set("phone")}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="+62 812 3456 7890"
            />
          </div>
        )}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Password *
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            placeholder="••••••••"
          />
          {mode === "register" && (
            <p className="mt-1 text-xs text-slate-500">At least 8 characters, including a number.</p>
          )}
        </div>

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-4 space-y-1.5 text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>
            <p>
              New here?{" "}
              <Link href="/register" className="font-semibold text-brand-700 hover:underline">
                Create an account
              </Link>
            </p>
            <p>
              <Link href="/forgot-password" className="hover:underline">
                Forgot your password?
              </Link>
            </p>
          </>
        ) : (
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        )}
        {role !== "CUSTOMER" && (
          <p>
            <Link href="/login" className="text-xs hover:underline">
              ← Back to customer login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
