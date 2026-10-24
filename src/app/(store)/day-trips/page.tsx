import type { Metadata } from "next";
import { TripLengthListing } from "@/components/TripLengthListing";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "1 Day Trips",
  description:
    "Same-day Bali tours and activities that start and finish in one day — half-day escapes, full-day adventures and back-by-evening experiences.",
  path: "/day-trips",
});

export default function DayTripsPage() {
  return <TripLengthListing length="day" />;
}
