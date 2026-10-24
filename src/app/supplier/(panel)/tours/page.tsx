import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, EmptyState, SmartImage } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { requireSupplierPanel, productStatusTone, statusLabel } from "@/lib/supplier";
import { effectiveFromPriceCents, parseDestinationLinks } from "@/lib/tours";
import { SupplierTourActions } from "@/components/SupplierTourActions";

export const metadata: Metadata = { title: "Tours" };

export default async function SupplierToursPage() {
  const { supplier } = await requireSupplierPanel();

  const [products, destinationRows] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        location: true,
        durationHours: true,
        durationLabel: true,
        priceAdultCents: true,
        currency: true,
        destinationLinks: true,
        category: { select: { name: true } },
        destination: { select: { name: true } },
        media: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { url: true },
        },
        options: { select: { priceAdultCents: true, tiers: { select: { priceCents: true } } } },
        _count: { select: { options: true, items: true } },
      },
    }),
    prisma.destination.findMany({ select: { id: true, name: true } }),
  ]);
  const destinationNames = new Map(destinationRows.map((d) => [d.id, d.name]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Catalog</p>
          <h1 className="font-display text-3xl font-bold text-slate-900">My tours</h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} tour{products.length === 1 ? "" : "s"} in your catalogue.
          </p>
        </div>
        <ButtonLink href="/supplier/tours/new" variant="dark">
          + New tour
        </ButtonLink>
      </div>

      {products.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tours yet"
            message="Create your first tour and submit it for review — it goes live once the admin team approves it."
            icon="🧳"
            action={
              <ButtonLink href="/supplier/tours/new" variant="dark">
                + New tour
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {products.map((tour) => {
            const effective = effectiveFromPriceCents(tour.priceAdultCents, tour.options);
            const hasStrike = effective > 0 && effective < tour.priceAdultCents;
            // Read destinations from destinationLinks — the same source the
            // edit form shows — so the catalogue always matches what was saved.
            const links = parseDestinationLinks(tour.destinationLinks);
            const savedDestinations = links
              .map((l) => destinationNames.get(l.id))
              .filter((n): n is string => Boolean(n));
            const destinationLabel =
              savedDestinations.length > 0
                ? savedDestinations.join(", ")
                : tour.destination?.name; // legacy fallback, same as the edit form
            const regions = links.flatMap((l) => l.regions).join(", ");
            const parts = [
              tour.durationLabel ?? `${tour.durationHours} h`,
              tour.category?.name,
              destinationLabel,
              regions || undefined,
              tour.location,
            ].filter((p): p is string => Boolean(p));
            // Drop repeated segments, e.g. destination "Ubud" + location "Ubud".
            const meta = parts.filter((p, i) => parts.indexOf(p) === i).join(" · ");

            return (
              <li key={tour.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <Link
                  href={`/supplier/tours/${tour.id}/edit`}
                  className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-24"
                >
                  <SmartImage
                    src={tour.media[0]?.url}
                    alt={tour.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/supplier/tours/${tour.id}/edit`}
                      className="font-display text-lg font-bold text-slate-900 hover:text-brand-700"
                    >
                      {tour.name}
                    </Link>
                    <Badge tone={productStatusTone(tour.status)}>{statusLabel(tour.status)}</Badge>
                  </div>
                  {meta && <p className="mt-0.5 truncate text-sm text-slate-500">{meta}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {tour._count.options} pricing option{tour._count.options === 1 ? "" : "s"}
                    {" · "}
                    {tour._count.items} booking{tour._count.items === 1 ? "" : "s"}
                    {" · "}
                    {effective > 0 ? (
                      <>
                        {"from "}
                        <span className="font-semibold text-slate-700">
                          {formatMoney(effective, tour.currency)}
                        </span>
                        {hasStrike && (
                          <span className="ml-1 text-slate-400 line-through">
                            {formatMoney(tour.priceAdultCents, tour.currency)}
                          </span>
                        )}
                      </>
                    ) : (
                      "no base price"
                    )}
                  </p>
                </div>

                <SupplierTourActions tourId={tour.id} tourName={tour.name} />
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Drafts stay private. Use <strong>Submit for review</strong> to send a tour to the admin team —
        you can keep editing while it is under review.
      </p>
    </>
  );
}
