"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { AGENT_STATUSES } from "@/lib/admin-nav";

export type AgentValues = {
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  commissionPercent: string;
  status: string;
  notes: string;
};

/** Create / edit a B2B agent — posts to /api/admin/agents[/:id]. */
export function AgentForm({
  initial,
  mode,
  agentId,
}: {
  initial: AgentValues;
  mode: "create" | "edit";
  agentId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof AgentValues) => (
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
      const res = await fetch(mode === "create" ? "/api/admin/agents" : `/api/admin/agents/${agentId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          company: v.company || undefined,
          email: v.email,
          phone: v.phone || undefined,
          country: v.country || undefined,
          commissionBps: Math.round((Number(v.commissionPercent) || 0) * 100),
          status: v.status,
          notes: v.notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save this agent.");
        return;
      }
      setSaved(true);
      router.refresh();
      if (mode === "create") router.push("/admin/agents");
    } catch {
      setError("Network error — your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {saved && mode === "edit" && <div className="mb-4"><Alert tone="success">Agent saved.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor="name" required>
          <Input id="name" value={v.name} onChange={set("name")} required minLength={1} maxLength={120} />
        </Field>
        <Field label="Company" htmlFor="company">
          <Input id="company" value={v.company} onChange={set("company")} maxLength={160} />
        </Field>
        <Field label="Email" htmlFor="email" required>
          <Input id="email" type="email" value={v.email} onChange={set("email")} required />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" value={v.phone} onChange={set("phone")} maxLength={40} />
        </Field>
        <Field label="Country" htmlFor="country">
          <Input id="country" value={v.country} onChange={set("country")} maxLength={80} />
        </Field>
        <Field label="Commission %" htmlFor="commissionPercent" hint="Agent / member net discount for this partner.">
          <Input id="commissionPercent" inputMode="decimal" value={v.commissionPercent} onChange={set("commissionPercent")} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={v.status} onChange={set("status")}>
            {AGENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" value={v.notes} onChange={set("notes")} maxLength={2000} />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Add agent" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
