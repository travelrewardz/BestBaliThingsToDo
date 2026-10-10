"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Textarea, Button, Alert } from "@/components/ui";

type ProfileValues = {
  companyName: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address: string;
  city: string;
  description: string;
};

/** Supplier profile editor — PATCHes /api/supplier/profile. */
export function SupplierProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ProfileValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setSaved(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/supplier/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save your profile. Please try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <Alert tone="success">Profile updated.</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="companyName" required>
          <Input
            id="companyName"
            value={values.companyName}
            onChange={set("companyName")}
            required
            minLength={2}
            maxLength={120}
          />
        </Field>
        <Field
          label="Contact email"
          htmlFor="email"
          required
          hint="Shown to customers and used for booking notifications."
        >
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={set("email")}
            required
          />
        </Field>
        <Field label="Phone" htmlFor="phone" required>
          <Input id="phone" value={values.phone} onChange={set("phone")} required minLength={5} />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp">
          <Input id="whatsapp" value={values.whatsapp} onChange={set("whatsapp")} placeholder="+62 …" />
        </Field>
        <Field label="Website" htmlFor="website">
          <Input id="website" type="url" value={values.website} onChange={set("website")} placeholder="https://…" />
        </Field>
        <Field label="City / area" htmlFor="city">
          <Input id="city" value={values.city} onChange={set("city")} placeholder="e.g. Ubud" />
        </Field>
        <Field label="Address" htmlFor="address" className="sm:col-span-2">
          <Input id="address" value={values.address} onChange={set("address")} />
        </Field>
        <Field
          label="About the company"
          htmlFor="description"
          className="sm:col-span-2"
          hint="Short description shown on your profile and listings."
        >
          <Textarea id="description" value={values.description} onChange={set("description")} maxLength={2000} />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>}
      </div>
    </form>
  );
}
