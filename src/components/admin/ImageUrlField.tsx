"use client";

import { useRef, useState } from "react";
import { Button, Field, Input } from "@/components/ui";

/**
 * URL text field with an "Upload from device" button and a live thumbnail.
 * The uploaded file is stored server-side and its public URL fills the field.
 */
export function ImageUrlField({
  label,
  htmlFor,
  hint,
  subdir,
  value,
  onChange,
  maxLength = 500,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  subdir: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subdir", subdir);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({} as { error?: { message?: string }; url?: string }));
      if (!res.ok || !data.url) throw new Error(data?.error?.message ?? "Upload failed.");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please retry.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Field label={label} htmlFor={htmlFor} hint={hint}>
      <div className="flex items-start gap-2">
        <span className="mt-1 hidden h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:block">
          {value.trim() && (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded URLs may be cross-origin
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </span>
        <Input id={htmlFor} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} />
        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Uploading…" : "⬆"}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => void onPick(e.target.files)}
      />
    </Field>
  );
}
