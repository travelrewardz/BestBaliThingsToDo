"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "dark";

/** Fires an admin mutation (JSON body) then refreshes the server component. */
export function ActionButton({
  endpoint,
  method = "POST",
  body,
  label,
  busyLabel = "Working…",
  confirm,
  prompt,
  promptKey = "note",
  variant = "outline",
  size = "sm",
  className = "",
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  label: string;
  busyLabel?: string;
  confirm?: string;
  /** When set, asks the admin for text (stored under `promptKey`). */
  prompt?: string;
  promptKey?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    const payload: Record<string, unknown> = { ...(body ?? {}) };
    if (prompt) {
      const answer = window.prompt(prompt);
      if (answer === null) return;
      payload[promptKey] = answer;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: { message?: string } }));
        setError(data?.error?.message ?? "Action failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} className={className} disabled={busy} onClick={run}>
        {busy ? busyLabel : label}
      </Button>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </span>
  );
}
