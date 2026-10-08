"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Alert } from "@/components/ui";

export function SupplierRegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    phone: "",
    whatsapp: "",
    website: "",
    city: "",
    description: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/supplier/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Something went wrong");
        setLoading(false);
        return;
      }
      router.push("/supplier");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-7 shadow-xl">
      <h2 className="font-display text-xl font-bold">Supplier application</h2>
      <p className="mt-1 text-sm text-slate-500">
        Our team reviews every application within 2 business days.
      </p>
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Your full name *</label>
          <input required value={form.name} onChange={set("name")} className={input} placeholder="I Wayan Sudarma" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email *</label>
          <input type="email" required value={form.email} onChange={set("email")} className={input} placeholder="you@company.com" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Company name *</label>
          <input required value={form.companyName} onChange={set("companyName")} className={input} placeholder="Bali Adventure Co." />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone *</label>
          <input required minLength={5} value={form.phone} onChange={set("phone")} className={input} placeholder="+62 812 3456 7890" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">WhatsApp</label>
          <input value={form.whatsapp} onChange={set("whatsapp")} className={input} placeholder="+6281234567890" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">City / base</label>
          <input value={form.city} onChange={set("city")} className={input} placeholder="Ubud" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Website</label>
          <input value={form.website} onChange={set("website")} className={input} placeholder="https://…" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">About your company</label>
          <textarea value={form.description} onChange={set("description")} className={input} rows={3} placeholder="What experiences do you offer? Since when? Licences held?" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password *</label>
          <input type="password" required minLength={8} value={form.password} onChange={set("password")} className={input} placeholder="At least 8 chars + a number" />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already a supplier?{" "}
        <Link href="/supplier/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
