import { handle, jsonOk, ApiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { uniqueTourSlug } from "@/lib/tours";

/** POST /api/supplier/tours/[id]/duplicate — copy a tour as a new draft. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async (req) => {
    const { id } = await ctx.params;
    const user = await requireApiUser(req, { roles: ["SUPPLIER"] });
    if (!user.supplierId) throw new ApiError(403, "No supplier profile on this account", "no_supplier");

    const source = await prisma.product.findFirst({
      where: { id, supplierId: user.supplierId },
      include: {
        options: { orderBy: { sortOrder: "asc" }, include: { tiers: { orderBy: { sortOrder: "asc" } } } },
        media: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!source) throw new ApiError(404, "Tour not found", "not_found");

    const name = `${source.name} (copy)`.slice(0, 160);
    const slug = await uniqueTourSlug(name);

    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          supplierId: source.supplierId,
          slug,
          name,
          shortDescription: source.shortDescription,
          description: source.description,
          seoTitle: source.seoTitle,
          seoDescription: source.seoDescription,
          seoKeywords: source.seoKeywords,
          categoryId: source.categoryId,
          categoryLinks: source.categoryLinks,
          destinationId: source.destinationId,
          destinationLinks: source.destinationLinks,
          location: source.location,
          meetingPoint: source.meetingPoint,
          pickupInfo: source.pickupInfo,
          durationHours: source.durationHours,
          durationLabel: source.durationLabel,
          languages: source.languages,
          tourType: source.tourType,
          minParticipants: source.minParticipants,
          maxParticipants: source.maxParticipants,
          ageRestriction: source.ageRestriction,
          difficulty: source.difficulty,
          instantConfirm: source.instantConfirm,
          freeCancellation: source.freeCancellation,
          cancellationPolicy: source.cancellationPolicy,
          familyFriendly: source.familyFriendly,
          currency: source.currency,
          priceAdultCents: source.priceAdultCents,
          priceChildCents: source.priceChildCents,
          priceInfantCents: source.priceInfantCents,
          privateGroupCents: source.privateGroupCents,
          singleTravelerCents: source.singleTravelerCents,
          supplierCostCents: source.supplierCostCents,
          commissionRateBps: source.commissionRateBps,
          weekendRateBps: source.weekendRateBps,
          highlights: source.highlights,
          itinerary: source.itinerary,
          inclusions: source.inclusions,
          exclusions: source.exclusions,
          whatToBring: source.whatToBring,
          importantInfo: source.importantInfo,
          terms: source.terms,
          faq: source.faq,
          defaultCapacity: source.defaultCapacity,
          bookingCutoffHours: source.bookingCutoffHours,
          maxAdvanceDays: source.maxAdvanceDays,
          status: "DRAFT",
          options: {
            create: source.options.map((o, i) => ({
              name: o.name,
              startTime: o.startTime,
              description: o.description,
              priceAdultCents: o.priceAdultCents,
              priceChildCents: o.priceChildCents,
              priceInfantCents: o.priceInfantCents,
              capacityOffset: o.capacityOffset,
              agentNetBps: o.agentNetBps,
              sortOrder: i,
              active: o.active,
              tiers: {
                create: o.tiers.map((t, ti) => ({
                  label: t.label,
                  minPax: t.minPax,
                  maxPax: t.maxPax,
                  priceCents: t.priceCents,
                  sortOrder: ti,
                })),
              },
            })),
          },
          media: {
            create: source.media.map((m, i) => ({
              url: m.url,
              alt: m.alt,
              title: m.title,
              caption: m.caption,
              isPrimary: i === 0,
              sortOrder: i,
            })),
          },
        },
        select: { id: true, name: true, slug: true, status: true },
      });
      return created;
    });

    await audit({
      user,
      action: "supplier.tour.duplicate",
      entityType: "Product",
      entityId: copy.id,
      summary: `${user.name} duplicated tour "${source.name}" as a draft.`,
    });

    return jsonOk({ tour: copy }, { status: 201 });
  });
}
