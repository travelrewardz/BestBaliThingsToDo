"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ImageUrlField } from "@/components/admin/ImageUrlField";

export type CategoryValues = {
  name: string;
  slug: string;
  kind: "CATEGORY" | "ACTIVITY";
  description: string;
  image: string;
  icon: string;
  sortOrder: string;
  active: boolean;
};

export function CategoryForm({
  initial,
  mode,
  categoryId,
}: {
  initial: CategoryValues;
  mode: "create" | "edit";
  categoryId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof CategoryValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    setV((prev) => ({
      ...prev,
      [key]: target.type === "checkbox" ? target.checked : target.value,
    }));
    setSaved(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/categories" : `/api/admin/categories/${categoryId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          slug: v.slug || undefined,
          kind: v.kind,
          description: v.description || undefined,
          image: v.image || undefined,
          icon: v.icon || undefined,
          sortOrder: Number(v.sortOrder) || 0,
          active: v.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save this category.");
        return;
      }
      setSaved(true);
      router.refresh();
      if (mode === "create") router.push("/admin/destinations");
    } catch {
      setError("Network error — your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {saved && mode === "edit" && (
        <div className="mb-4">
          <Alert tone="success">Category saved.</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required>
          <Input id="name" value={v.name} onChange={set("name")} required minLength={2} maxLength={60} placeholder="Water sports" />
        </Field>
        <Field label="URL slug" htmlFor="slug" hint="Leave empty to generate it from the name.">
          <Input id="slug" value={v.slug} onChange={set("slug")} maxLength={80} placeholder="water-sports" />
        </Field>
        <Field label="Kind" htmlFor="kind" hint="CATEGORY appears on the homepage; ACTIVITY powers /activity/ pages.">
          <Select id="kind" value={v.kind} onChange={set("kind")}>
            <option value="CATEGORY">CATEGORY</option>
            <option value="ACTIVITY">ACTIVITY</option>
          </Select>
        </Field>
        <Field label="Icon" htmlFor="icon" hint="Optional emoji shown next to the category.">
          <Input id="icon" value={v.icon} onChange={set("icon")} maxLength={40} placeholder="🤿" />
        </Field>
        <ImageUrlField
          label="Image"
          htmlFor="image"
          subdir="categories"
          hint="Paste a URL or upload from your device."
          value={v.image}
          onChange={(value) => {
            setV((prev) => ({ ...prev, image: value }));
            setSaved(false);
          }}
        />
        <Field label="Sort order" htmlFor="sortOrder" hint="Lower numbers show first.">
          <Input id="sortOrder" type="number" min="0" value={v.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" value={v.description} onChange={set("description")} maxLength={2000} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={v.active} onChange={set("active")} />
          Active (suppliers can select it on their tours)
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
