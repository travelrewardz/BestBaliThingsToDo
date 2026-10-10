"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Heart toggle on tour cards. Must be a client component (event handler). */
export function FavoriteButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      aria-label={saved ? "Saved to favorites" : "Save to favorites"}
      aria-pressed={saved}
      className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-sm shadow-sm hover:bg-white"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        }).then((r) => {
          if (r.status === 401) router.push("/login");
          else if (r.ok) setSaved(true);
        });
      }}
    >
      {saved ? "❤️" : "🤍"}
    </button>
  );
}
