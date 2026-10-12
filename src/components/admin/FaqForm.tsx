"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export type FaqValues = {
  question: string;
  answer: string;
  scope: string;
  sortOrder: string;
  active: boolean;
};

export function FaqForm({
  initial,
  mode,
  faqId,
}: {
  initial: FaqValues;
  mode: "create" | "edit";
  faqId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof FaqValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    setV((prev) => ({ ...prev, [key]: target.type === "checkbox" ? target.checked : target.value }));
    setSaved(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/faqs" : `/api/admin/faqs/${faqId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: v.question,
          answer: v.answer,
          scope: v.scope,
          sortOrder: Number(v.sortOrder) || 0,
          active: v.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save this FAQ.");
        return;
      }
      setSaved(true);
      router.refresh();
      if (mode === "create") router.push("/admin/cms");
    } catch {
      setError("Network error — your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {saved && mode === "edit" && <div className="mb-4"><Alert tone="success">FAQ saved.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Question" htmlFor="question" required className="sm:col-span-2">
          <Input id="question" value={v.question} onChange={set("question")} required minLength={1} maxLength={300} />
        </Field>
        <Field label="Answer" htmlFor="answer" required className="sm:col-span-2">
          <Textarea id="answer" value={v.answer} onChange={set("answer")} required minLength={1} maxLength={4000} className="min-h-32" />
        </Field>
        <Field label="Scope" htmlFor="scope" hint="Where this FAQ appears.">
          <Select id="scope" value={v.scope} onChange={set("scope")}>
            <option value="SITE">Site-wide</option>
            <option value="PRODUCT">Product</option>
            <option value="DESTINATION">Destination</option>
            <option value="CATEGORY">Category</option>
            <option value="BLOG">Blog</option>
          </Select>
        </Field>
        <Field label="Sort order" htmlFor="sortOrder" hint="Lower numbers show first.">
          <Input id="sortOrder" type="number" min="0" value={v.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={v.active} onChange={set("active")} />
          Active (visible on the site)
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create FAQ" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
