"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** "Upload images" button for the media library (multi-select). */
export function MediaUploader() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const queue = Array.from(files);
    setBusy(queue.length);
    setError(null);
    try {
      let done = 0;
      for (const file of queue) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("subdir", "admin");
        const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({} as { error?: { message?: string } }));
        if (!res.ok) throw new Error(data?.error?.message ?? `Could not upload ${file.name}.`);
        done += 1;
        setBusy(queue.length - done);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please retry.");
    } finally {
      setBusy(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" variant="dark" disabled={busy > 0} onClick={() => fileRef.current?.click()}>
        {busy > 0 ? `Uploading ${busy}…` : "⬆ Upload images"}
      </Button>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
        multiple
        className="hidden"
        onChange={(e) => void onPick(e.target.files)}
      />
    </span>
  );
}
