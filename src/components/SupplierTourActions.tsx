"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ICON_BTN =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

/** Duplicate / edit / delete controls for a tour row. */
export function SupplierTourActions({ tourId, tourName }: { tourId: string; tourName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "duplicate" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    setBusy("duplicate");
    setError(null);
    try {
      const res = await fetch(`/api/supplier/tours/${tourId}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not duplicate this tour.");
        return;
      }
      router.push(`/supplier/tours/${data.tour.id}/edit`);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${tourName}”? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/supplier/tours/${tourId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not delete this tour.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Duplicate as a new draft"
          aria-label={`Duplicate ${tourName}`}
          className={ICON_BTN}
          disabled={busy !== null}
          onClick={duplicate}
        >
          <span aria-hidden>⧉</span>
        </button>
        <button
          type="button"
          title="Edit tour"
          aria-label={`Edit ${tourName}`}
          className={ICON_BTN}
          onClick={() => router.push(`/supplier/tours/${tourId}/edit`)}
        >
          <span aria-hidden>✎</span>
        </button>
        <button
          type="button"
          title="Delete tour"
          aria-label={`Delete ${tourName}`}
          className={`${ICON_BTN} text-red-600 hover:border-red-300`}
          disabled={busy !== null}
          onClick={remove}
        >
          <span aria-hidden>🗑</span>
        </button>
      </div>
      {error && <p className="max-w-56 text-right text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
