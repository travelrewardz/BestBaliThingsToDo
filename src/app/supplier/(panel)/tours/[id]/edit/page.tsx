import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupplierPanel } from "@/lib/supplier";
import { parseStringList } from "@/lib/tours";
import { SupplierTourForm } from "@/components/SupplierTourForm";

export const metadata: Metadata = { title: "Edit tour" };

type TourWithChildren = Prisma.ProductGetPayload<{
  include: { options: true; media: true };
}>;

const money = (cents: number | null | undefined) =>
  cents && cents > 0 ? (cents / 100).toFixed(2) : "";

export default async function EditSupplierTourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supplier } = await requireSupplierPanel();

  const [tour, categories, destinations] = await Promise.all([
    prisma.product.findFirst({
      where: { id, supplierId: supplier.id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    }) as Promise<TourWithChildren | null>,
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.destination.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!tour) notFound();

  return (
    <>
      <Link href="/supplier/tours" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to my tours
      </Link>
      <div className="mt-3">
        <h1 className="font-display text-2xl font-bold text-slate-900">{tour.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Editing <span className="font-mono text-xs">/{tour.slug}</span>
        </p>
      </div>

      <div className="mt-6">
        <SupplierTourForm
          mode="edit"
          tourId={tour.id}
          status={tour.status}
          adminNote={tour.adminNote}
          categories={categories}
          destinations={destinations}
          initial={{
            name: tour.name,
            slug: tour.slug,
            shortTitle: tour.shortTitle ?? "",
            subtitle: tour.subtitle ?? "",
            description: tour.description,
            categoryId: tour.categoryId ?? "",
            destinationId: tour.destinationId ?? "",
            location: tour.location ?? "",
            meetingPoint: tour.meetingPoint ?? "",
            pickupInfo: tour.pickupInfo ?? "",
            durationHours: String(tour.durationHours),
            durationLabel: tour.durationLabel ?? "",
            tourType: tour.tourType === "PRIVATE" ? "PRIVATE" : "GROUP",
            minParticipants: String(tour.minParticipants),
            maxParticipants: String(tour.maxParticipants),
            difficulty:
              tour.difficulty === "MODERATE" || tour.difficulty === "CHALLENGING"
                ? tour.difficulty
                : "EASY",
            instantConfirm: tour.instantConfirm,
            freeCancellation: tour.freeCancellation,
            familyFriendly: tour.familyFriendly,
            currency: tour.currency,
            priceAdult: money(tour.priceAdultCents),
            priceChild: money(tour.priceChildCents),
            priceInfant: money(tour.priceInfantCents),
            defaultCapacity: String(tour.defaultCapacity),
            bookingCutoffHours: String(tour.bookingCutoffHours),
            maxAdvanceDays: String(tour.maxAdvanceDays),
            highlights: parseStringList(tour.highlights).join("\n"),
            inclusions: parseStringList(tour.inclusions).join("\n"),
            exclusions: parseStringList(tour.exclusions).join("\n"),
            whatToBring: parseStringList(tour.whatToBring).join("\n"),
            importantInfo: tour.importantInfo ?? "",
            mediaUrls: tour.media.length ? tour.media.map((m) => m.url) : [""],
            options: tour.options.map((o) => ({
              id: o.id,
              name: o.name,
              startTime: o.startTime ?? "",
              description: o.description ?? "",
              priceAdult: money(o.priceAdultCents),
              priceChild: money(o.priceChildCents),
              priceInfant: money(o.priceInfantCents),
              capacityOffset: String(o.capacityOffset),
              active: o.active,
            })),
          }}
        />
      </div>
    </>
  );
}
