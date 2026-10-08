"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [destination, setDestination] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (destination) params.set("destination", destination);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className={`flex w-full flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row sm:items-center ${
        compact ? "" : "ring-4 ring-brand-500/20"
      }`}
      role="search"
    >
      <div className="flex flex-1 items-center gap-2 px-3">
        <span aria-hidden>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search e.g. ATV Ubud, rafting, Nusa Penida…"
          aria-label="Search activities"
          className="w-full bg-transparent py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <div className="hidden h-8 w-px bg-slate-200 sm:block" />
      <div className="flex flex-1 items-center gap-2 px-3">
        <span aria-hidden>📍</span>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          aria-label="Destination"
          className="w-full bg-transparent py-3 text-sm text-slate-600 focus:outline-none"
        >
          <option value="">Where do you want to go?</option>
          <option value="ubud">Ubud</option>
          <option value="nusa-penida">Nusa Penida</option>
          <option value="canggu">Canggu</option>
          <option value="seminyak">Seminyak</option>
          <option value="kuta">Kuta</option>
          <option value="uluwatu">Uluwatu</option>
          <option value="kintamani">Kintamani</option>
          <option value="mount-batur">Mount Batur</option>
        </select>
      </div>
      <button
        type="submit"
        className="rounded-xl bg-sunset-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-sunset-600"
      >
        Search
      </button>
    </form>
  );
}
