import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validateCoupon, couponDiscount } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(3).max(40),
  subtotalCents: z.number().int().min(0),
  productId: z.string().min(1),
});

/** POST /api/coupons/validate — checkout-time coupon check. */
export async function POST(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { permissions: ["customer.booking.create"] });
    const body = await parseJson(req, schema);

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, supplierId: true, currency: true },
    });
    if (!product) throw new ApiError(404, "Tour not found", "not_found");

    const coupon = await prisma.coupon.findUnique({
      where: { code: body.code.trim().toUpperCase() },
    });
    const userUsage = await prisma.booking.count({
      where: {
        customerId: user.id,
        couponCode: body.code.trim().toUpperCase(),
        status: { notIn: ["CANCELLED"] },
      },
    });

    const check = validateCoupon(coupon, {
      subtotalCents: body.subtotalCents,
      productId: product.id,
      supplierId: product.supplierId,
      userUsage,
    });
    if (!check.ok) throw new ApiError(400, check.reason, "invalid_coupon");

    const discount = couponDiscount(check.coupon, body.subtotalCents);
    return jsonOk({
      valid: true,
      code: check.coupon.code,
      discountCents: discount,
      display: formatMoney(discount, product.currency),
      description: check.coupon.description,
    });
  });
}
