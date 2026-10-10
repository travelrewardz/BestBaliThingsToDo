import { handle, jsonOk, ApiError, parseJson } from "@/lib/api";
import { quoteBooking, BookingError } from "@/lib/bookings";
import { AvailabilityError } from "@/lib/availability";
import { z } from "zod";
import { formatMoney } from "@/lib/money";

const schema = z.object({
  productId: z.string().min(1),
  optionId: z.string().nullish(),
  date: z.string().min(4),
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50).optional(),
  infants: z.number().int().min(0).max(50).optional(),
  couponCode: z.string().max(40).nullish(),
  userId: z.string().nullish(),
});

function mapError(err: unknown): never {
  if (err instanceof BookingError) throw new ApiError(err.status, err.message, err.code);
  if (err instanceof AvailabilityError) {
    throw new ApiError(409, err.message, err.code);
  }
  throw err;
}

/** POST /api/quote — price preview without reserving anything. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const body = await parseJson(req, schema);
    try {
      const quote = await quoteBooking(body);
      return jsonOk({
        quote,
        display: {
          subtotal: formatMoney(quote.subtotalCents, quote.currency),
          discount: formatMoney(quote.discountCents, quote.currency),
          total: formatMoney(quote.totalCents, quote.currency),
        },
      });
    } catch (err) {
      mapError(err);
    }
  });
}
