import type { Metadata } from "next";
import { TripLengthListing } from "@/components/TripLengthListing";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Multi-day Trips",
  description:
    "Bali tours spanning 24 hours or more — island hops, overnight journeys and multi-day adventures across Bali and beyond.",
  path: "/multi-day-trips",
});

export default function MultiDayTripsPage() {
  return <TripLengthListing length="multiday" />;
}
