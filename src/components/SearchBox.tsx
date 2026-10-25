"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type SearchActivity = { name: string; slug: string; icon?: string | null };

export function SearchBox({
  compact = false,
  activities = [],
}: {
  compact?: boolean;
  activities?: SearchActivity[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activity, setActivity] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Picking an activity opens its live page; free text keeps the search URL.
    if (activity) {
      router.push(`/activity/${activity}`);
      return;
    }
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
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
        <span aria-hidden>🎯</span>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          aria-label="Activity"
          className="w-full bg-transparent py-3 text-sm text-slate-600 focus:outline-none"
        >
          <option value="">What do you want to do?</option>
          {activities.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.icon ? `${a.icon} ` : ""}
              {a.name}
            </option>
          ))}
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
