import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSupplierPanel } from "@/lib/supplier";
import { SupplierTourForm, type TourFormValues } from "@/components/SupplierTourForm";

export const metadata: Metadata = { title: "New tour" };

const emptyTour = (currency: string): TourFormValues => ({
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  destinationLinks: [{ id: "", regions: "" }],
  categoryLinks: [],
  tripLength: "DAY",
  location: "",
  meetingPoint: "",
  pickupInfo: "",
  durationHours: "4",
  durationLabel: "",
  difficulty: "EASY",
  minParticipants: "1",
  maxParticipants: "15",
  tourType: "GROUP",
  instantConfirm: true,
  freeCancellation: true,
  familyFriendly: true,
  highlights: "",
  inclusions: "",
  exclusions: "",
  whatToBring: "",
  importantInfo: "",
  itinerary: [],
  faq: [],
  currency,
  priceAdult: "",
  priceChild: "",
  priceInfant: "",
  defaultCapacity: "20",
  bookingCutoffHours: "12",
  maxAdvanceDays: "180",
  options: [],
  mediaUrls: [""],
});

export default async function NewSupplierTourPage() {
  const { supplier } = await requireSupplierPanel();

  const [categories, activities, destinations] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, kind: "CATEGORY" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { active: true, kind: "ACTIVITY" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.destination.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, region: true },
    }),
  ]);

  return (
    <>
      <Link href="/supplier/tours" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to my tours
      </Link>
      <div className="mt-3">
        <h1 className="font-display text-2xl font-bold text-slate-900">New tour</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the three tabs and save a draft, or submit it for admin review to get it published.
        </p>
      </div>
      <div className="mt-6">
        <SupplierTourForm
          mode="create"
          initial={emptyTour(supplier.currency ?? "USD")}
          categories={categories}
          activities={activities}
          destinations={destinations}
          preferredCurrency={supplier.currency ?? "USD"}
        />
      </div>
    </>
  );
}
