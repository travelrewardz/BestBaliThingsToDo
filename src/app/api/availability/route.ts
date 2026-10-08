import { handle, jsonOk, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { remainingSeats, tourDateKey, AvailabilityError } from "@/lib/availability";
import { priceForDate } from "@/lib/finance";

/** GET /api/availability?productId=...&date=2026-10-20 */
export async function GET(req: Request) {
  return handle(req, async (req) => {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const dateParam = url.searchParams.get("date");
    if (!productId || !dateParam) {
      throw new ApiError(400, "productId and date are required", "validation");
    }
    const date = tourDateKey(dateParam);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, "Invalid date", "validation");

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { options: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!product) throw new ApiError(404, "Tour not found", "not_found");

    let availability: Awaited<ReturnType<typeof remainingSeats>>;
    try {
      availability = await remainingSeats(product.id, date, product);
    } catch (err) {
      if (err instanceof AvailabilityError) {
        return jsonOk({ date: date.toISOString(), closed: true, remaining: 0, capacity: 0, options: product.options });
      }
      throw err;
    }

    const price = await priceForDate(product, date);
    return jsonOk({
      date: date.toISOString(),
      closed: availability.closed,
      remaining: availability.remaining,
      capacity: availability.capacity,
      price,
      currency: product.currency,
      options: product.options,
      minParticipants: product.minParticipants,
      maxParticipants: product.maxParticipants,
      tourType: product.tourType,
    });
  });
}
