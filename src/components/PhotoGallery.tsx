"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SmartImage } from "@/components/ui";

/**
 * Tour hero gallery with click-to-enlarge.
 *
 * Renders the familiar hero collage (main photo + two thumbnails) where every
 * tile is clickable and opens a fullscreen lightbox that can browse ALL of
 * the tour's photos — arrows, keyboard (←/→/Esc), the counter and a
 * thumbnail strip at the bottom. When a tour has more photos than the three
 * shown in the hero, a "+N" badge (on the last thumbnail, or on the main
 * photo on mobile where thumbnails are hidden) jumps straight to the rest.
 */
export function PhotoGallery({
  images,
  name,
  children,
}: {
  images: string[];
  name: string;
  children?: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = index !== null;

  const main = images[0] ?? null;
  const thumbs = images.slice(1, 3);
  // Photos beyond the hero's main + 2 thumbnails.
  const hiddenCount = images.length - 3;

  const step = (delta: number) =>
    setIndex((i) =>
      i === null || images.length === 0
        ? i
        : (i + delta + images.length) % images.length
    );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, images.length]);

  return (
    <>
      <div className="mt-4 grid gap-2 lg:grid-cols-[2fr_1fr]">
        {main ? (
          <button
            type="button"
            onClick={() => setIndex(0)}
            aria-label={`View photo 1 of ${images.length}`}
            className="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <SmartImage
              src={main}
              alt={name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
            {children}
            {hiddenCount > 0 ? (
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
                +{hiddenCount} photos
              </span>
            ) : (
              images.length > 1 && (
                <span className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                  🔍 Click to enlarge
                </span>
              )
            )}
          </button>
        ) : (
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
            <SmartImage src={null} alt={name} fill />
            {children}
          </div>
        )}
        {thumbs.length > 0 && (
          <div className="hidden grid-rows-2 gap-2 lg:grid">
            {thumbs.map((url, i) => {
              const photoIndex = i + 1;
              const hasMore = i === thumbs.length - 1 && hiddenCount > 0;
              return (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  // The last tile jumps straight to the photos hidden from the hero.
                  onClick={() => setIndex(hasMore ? photoIndex + 1 : photoIndex)}
                  aria-label={
                    hasMore
                      ? `View ${hiddenCount} more photos`
                      : `View photo ${photoIndex + 1} of ${images.length}`
                  }
                  className="group relative overflow-hidden rounded-2xl bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <SmartImage
                    src={url}
                    alt={`${name} ${photoIndex + 1}`}
                    fill
                    sizes="30vw"
                  />
                  {hasMore && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-white transition-colors group-hover:bg-black/45">
                      <span className="font-display text-3xl font-extrabold leading-none">
                        +{hiddenCount}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wide">
                        photos
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isOpen && index !== null && images.length > 0 && (
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Photos of ${name}`}
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 outline-none"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIndex(null);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-bold tabular-nums text-white/90">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex(null)}
              aria-label="Close photo viewer"
              className="rounded-full p-2 text-xl leading-none text-white hover:bg-white/15"
            >
              ✕
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIndex(null);
            }}
          >
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute left-1 z-10 rounded-full bg-white/15 p-3 text-2xl leading-none text-white hover:bg-white/30 sm:left-4"
              >
                ‹
              </button>
            )}
            <div className="relative h-full w-full">
              <SmartImage
                src={images[index]}
                alt={`${name} ${index + 1}`}
                fill
                fit="contain"
                sizes="100vw"
              />
            </div>
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute right-1 z-10 rounded-full bg-white/15 p-3 text-2xl leading-none text-white hover:bg-white/30 sm:right-4"
              >
                ›
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {images.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={i === index}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg transition-opacity ${
                    i === index
                      ? "ring-2 ring-white"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <SmartImage src={url} alt="" fill sizes="56px" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
