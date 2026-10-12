"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export type CmsPageValues = {
  title: string;
  slug: string;
  content: string;
  status: string;
};

export function PageForm({
  initial,
  mode,
  pageId,
}: {
  initial: CmsPageValues;
  mode: "create" | "edit";
  pageId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof CmsPageValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/pages" : `/api/admin/pages/${pageId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: v.title, slug: v.slug || undefined, content: v.content, status: v.status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save this page.");
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
      {saved && mode === "edit" && <div className="mb-4"><Alert tone="success">Page saved.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" required>
          <Input id="title" value={v.title} onChange={set("title")} required minLength={1} maxLength={160} />
        </Field>
        <Field label="URL slug" htmlFor="slug" hint="Leave empty to generate it from the title.">
          <Input id="slug" value={v.slug} onChange={set("slug")} maxLength={80} placeholder="about-us" />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={v.status} onChange={set("status")}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </Select>
        </Field>
        <Field label="Content" htmlFor="content" className="sm:col-span-2" hint="Page body (HTML or Markdown).">
          <Textarea id="content" value={v.content} onChange={set("content")} maxLength={100000} className="min-h-64 font-mono text-xs" />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create page" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
