import Link from "next/link";
import { SmartImage, Badge, Stars } from "@/components/ui";
import { FavoriteButton } from "@/components/FavoriteButton";
import { formatMoney } from "@/lib/money";

export type TourCardData = {
  id: string;
  slug: string;
  name: string;
  shortTitle?: string | null;
  priceAdultCents: number;
  currency: string;
  durationLabel?: string | null;
  durationHours: number;
  ratingAvg: number;
  ratingCount: number;
  location?: string | null;
  instantConfirm?: boolean;
  freeCancellation?: boolean;
  tourType?: string;
  media?: { url: string; alt: string | null; isPrimary: boolean; sortOrder: number }[];
  destination?: { name: string; slug: string } | null;
  supplier?: { companyName: string } | null;
};

export function TourCard({ tour, priority = false }: { tour: TourCardData; priority?: boolean }) {
  const image = tour.media?.[0]?.url;
  const duration =
    tour.durationLabel ||
    (tour.durationHours >= 24
      ? `${Math.round(tour.durationHours / 24)} days`
      : tour.durationHours <= 1
        ? `${tour.durationHours * 60} minutes`
        : `${tour.durationHours} hours`);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
      <Link href={`/trip/${tour.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
        <SmartImage
          src={image}
          alt={tour.name}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {tour.tourType === "PRIVATE" && <Badge tone="brand">Private</Badge>}
          {tour.instantConfirm && <Badge tone="green">Instant</Badge>}
        </div>
        <FavoriteButton productId={tour.id} />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>📍 {tour.location || tour.destination?.name || "Bali"}</span>
          <span>·</span>
          <span>⏱ {duration}</span>
        </div>
        <Link href={`/trip/${tour.slug}`} className="mt-1.5 line-clamp-2 font-display text-base font-bold text-slate-900 hover:text-brand-700">
          {tour.name}
        </Link>
        {tour.supplier && (
          <p className="mt-0.5 text-xs text-slate-400">by {tour.supplier.companyName}</p>
        )}

        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {tour.ratingCount > 0 ? (
            <>
              <Stars rating={tour.ratingAvg} />
              <span className="font-semibold text-slate-700">{tour.ratingAvg.toFixed(1)}</span>
              <span className="text-slate-400">({tour.ratingCount})</span>
            </>
          ) : (
            <span className="text-slate-400">New experience</span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">From</p>
            <p className="text-lg font-extrabold text-brand-800">
              {formatMoney(tour.priceAdultCents, tour.currency)}
              <span className="text-xs font-medium text-slate-500"> / adult</span>
            </p>
          </div>
          <Link
            href={`/trip/${tour.slug}`}
            className="rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-800"
          >
            View deal
          </Link>
        </div>
      </div>
    </article>
  );
}
