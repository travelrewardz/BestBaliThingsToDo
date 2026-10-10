import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSupplierPanel } from "@/lib/supplier";
import { SupplierTourForm, type TourFormValues } from "@/components/SupplierTourForm";

export const metadata: Metadata = { title: "New tour" };

const emptyTour: TourFormValues = {
  name: "",
  slug: "",
  shortTitle: "",
  subtitle: "",
  description: "",
  categoryId: "",
  destinationId: "",
  location: "",
  meetingPoint: "",
  pickupInfo: "",
  durationHours: "4",
  durationLabel: "",
  tourType: "GROUP",
  minParticipants: "1",
  maxParticipants: "15",
  difficulty: "EASY",
  instantConfirm: true,
  freeCancellation: true,
  familyFriendly: true,
  currency: "USD",
  priceAdult: "",
  priceChild: "",
  priceInfant: "",
  defaultCapacity: "20",
  bookingCutoffHours: "12",
  maxAdvanceDays: "180",
  highlights: "",
  inclusions: "",
  exclusions: "",
  whatToBring: "",
  importantInfo: "",
  mediaUrls: [""],
  options: [],
};

export default async function NewSupplierTourPage() {
  await requireSupplierPanel();

  const [categories, destinations] = await Promise.all([
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

  return (
    <>
      <Link href="/supplier/tours" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to my tours
      </Link>
      <div className="mt-3">
        <h1 className="font-display text-2xl font-bold text-slate-900">New tour</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the details and save a draft, or submit it for admin review to get it published.
        </p>
      </div>
      <div className="mt-6">
        <SupplierTourForm
          mode="create"
          initial={emptyTour}
          categories={categories}
          destinations={destinations}
        />
      </div>
    </>
  );
}
