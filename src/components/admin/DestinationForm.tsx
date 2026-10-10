"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export type DestinationValues = {
  name: string;
  slug: string;
  region: string;
  description: string;
  intro: string;
  heroImage: string;
  image: string;
  sortOrder: string;
  active: boolean;
};

export function DestinationForm({
  initial,
  mode,
  destinationId,
}: {
  initial: DestinationValues;
  mode: "create" | "edit";
  destinationId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof DestinationValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      const res = await fetch(mode === "create" ? "/api/admin/destinations" : `/api/admin/destinations/${destinationId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          slug: v.slug || undefined,
          region: v.region || undefined,
          description: v.description || undefined,
          intro: v.intro || undefined,
          heroImage: v.heroImage || undefined,
          image: v.image || undefined,
          sortOrder: Number(v.sortOrder) || 0,
          active: v.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save this destination.");
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
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {saved && mode === "edit" && <div className="mb-4"><Alert tone="success">Destination saved.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required>
          <Input id="name" value={v.name} onChange={set("name")} required minLength={1} maxLength={120} />
        </Field>
        <Field label="URL slug" htmlFor="slug" hint="Leave empty to generate it from the name.">
          <Input id="slug" value={v.slug} onChange={set("slug")} maxLength={80} placeholder="ubud" />
        </Field>
        <Field label="Region" htmlFor="region" hint="e.g. South Bali, Central Bali.">
          <Input id="region" value={v.region} onChange={set("region")} maxLength={80} />
        </Field>
        <Field label="Sort order" htmlFor="sortOrder">
          <Input id="sortOrder" type="number" min="0" value={v.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <Field label="Hero image URL" htmlFor="heroImage">
          <Input id="heroImage" value={v.heroImage} onChange={set("heroImage")} maxLength={500} />
        </Field>
        <Field label="Card image URL" htmlFor="image">
          <Input id="image" value={v.image} onChange={set("image")} maxLength={500} />
        </Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" value={v.description} onChange={set("description")} maxLength={2000} />
        </Field>
        <Field label="SEO intro" htmlFor="intro" className="sm:col-span-2" hint="Unique copy for the destination landing page.">
          <Textarea id="intro" value={v.intro} onChange={set("intro")} maxLength={4000} className="min-h-32" />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={v.active} onChange={set("active")} />
          Active (visible on the site)
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create destination" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
