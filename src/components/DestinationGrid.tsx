"use client";

import { useState } from "react";
import Link from "next/link";
import { SmartImage } from "@/components/ui";

export type DestinationTile = {
  id: string;
  name: string;
  slug: string;
  heroImage?: string | null;
  emoji?: string;
};

/**
 * Homepage destinations grid. Shows the first `initial` cards and expands to
 * the full list in place via "View All" — no navigation, the page never moves.
 */
export function DestinationGrid({
  destinations,
  initial = 8,
}: {
  destinations: DestinationTile[];
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? destinations : destinations.slice(0, initial);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {visible.map((d) => (
          <Link
            key={d.id}
            href={`/destination/${d.slug}`}
            className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-brand-800 p-4"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            {d.heroImage && (
              <SmartImage
                src={d.heroImage}
                alt={d.name}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="transition-transform duration-500 group-hover:scale-110"
              />
            )}
            <span className="relative font-display text-lg font-bold text-white">
              {d.emoji ? `${d.emoji} ` : ""}
              {d.name}
            </span>
          </Link>
        ))}
      </div>

      {destinations.length > initial && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-700"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : `View All (${destinations.length})`}
          </button>
        </div>
      )}
    </>
  );
}
