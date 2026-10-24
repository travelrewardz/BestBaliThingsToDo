import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupplierPanel } from "@/lib/supplier";
import { parseStringList, parseDestinationLinks, parseItinerary, parseFaq } from "@/lib/tours";
import { SupplierTourForm } from "@/components/SupplierTourForm";

export const metadata: Metadata = { title: "Edit tour" };

type TourWithChildren = Prisma.ProductGetPayload<{
  include: {
    options: { include: { tiers: true; questions: true } };
    media: true;
  };
}>;

const money = (cents: number | null | undefined) =>
  cents && cents > 0 ? (cents / 100).toFixed(2) : "";

const percent = (bps: number | null | undefined) =>
  bps != null && bps > 0 ? String(bps / 100) : "";

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
        options: {
          orderBy: { sortOrder: "asc" },
          include: {
            tiers: { orderBy: { sortOrder: "asc" } },
            questions: { orderBy: { sortOrder: "asc" } },
          },
        },
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
      select: { id: true, name: true, region: true },
    }),
  ]);

  if (!tour) notFound();

  const destinationLinks = parseDestinationLinks(tour.destinationLinks);

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
          preferredCurrency={supplier.currency ?? tour.currency}
          initial={{
            name: tour.name,
            slug: tour.slug,
            shortDescription: tour.shortDescription ?? "",
            description: tour.description,
            seoTitle: tour.seoTitle ?? "",
            seoDescription: tour.seoDescription ?? "",
            seoKeywords: tour.seoKeywords ?? "",
            destinationLinks: destinationLinks.length
              ? destinationLinks.map((d) => ({ id: d.id, regions: d.regions.join(", ") }))
              : tour.destinationId
                ? [{ id: tour.destinationId, regions: "" }]
                : [],
            categoryLinks: parseStringList(tour.categoryLinks).length
              ? parseStringList(tour.categoryLinks)
              : tour.categoryId
                ? [tour.categoryId]
                : [],
            tripLength: tour.tripLength === "MULTIDAY" ? "MULTIDAY" : "DAY",
            location: tour.location ?? "",
            meetingPoint: tour.meetingPoint ?? "",
            pickupInfo: tour.pickupInfo ?? "",
            durationHours: String(tour.durationHours),
            durationLabel: tour.durationLabel ?? "",
            difficulty:
              tour.difficulty === "MODERATE" || tour.difficulty === "CHALLENGING"
                ? tour.difficulty
                : "EASY",
            minParticipants: String(tour.minParticipants),
            maxParticipants: String(tour.maxParticipants),
            tourType: tour.tourType === "PRIVATE" ? "PRIVATE" : "GROUP",
            instantConfirm: tour.instantConfirm,
            freeCancellation: tour.freeCancellation,
            familyFriendly: tour.familyFriendly,
            highlights: parseStringList(tour.highlights).join("\n"),
            inclusions: parseStringList(tour.inclusions).join("\n"),
            exclusions: parseStringList(tour.exclusions).join("\n"),
            whatToBring: parseStringList(tour.whatToBring).join("\n"),
            importantInfo: tour.importantInfo ?? "",
            itinerary: parseItinerary(tour.itinerary),
            faq: parseFaq(tour.faq),
            currency: tour.currency,
            priceAdult: money(tour.priceAdultCents),
            priceChild: money(tour.priceChildCents),
            priceInfant: money(tour.priceInfantCents),
            defaultCapacity: String(tour.defaultCapacity),
            bookingCutoffHours: String(tour.bookingCutoffHours),
            maxAdvanceDays: String(tour.maxAdvanceDays),
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
              agentNet: percent(o.agentNetBps),
              active: o.active,
              tiers: o.tiers.map((t) => ({
                id: t.id,
                label: t.label,
                minPax: String(t.minPax),
                maxPax: t.maxPax != null ? String(t.maxPax) : "",
                price: money(t.priceCents),
              })),
              questions: o.questions.map((q) => ({
                id: q.id,
                label: q.label,
                type: q.type === "READ_ONLY" || q.type === "SELECT" ? q.type : "TEXT",
                remark: q.remark ?? "",
                choices: parseStringList(q.choices).join("\n"),
                required: q.required,
              })),
            })),
          }}
        />
      </div>
    </>
  );
}
