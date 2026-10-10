import type { Coupon, Product, Promotion, Supplier } from "@prisma/client";
import { applyBps } from "@/lib/money";
import { weekdayOf, tourDateKey } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

// ------------------------------------------------------------
// Pricing
// ------------------------------------------------------------

export type PriceBreak = { adult: number; child: number; infant: number };

/**
 * Product price for a date, including weekend & seasonal surcharges.
 * Price rules are loaded lazily from the DB when not supplied.
 */
export async function priceForDate(
  product: Product,
  date: Date,
  option?: {
    priceAdultCents: number | null;
    priceChildCents: number | null;
    priceInfantCents: number | null;
  } | null,
  rules?: Array<{
    type: string;
    dateFrom: Date | null;
    dateTo: Date | null;
    weekdays: string | null;
    surchargeBps: number;
    active: boolean;
  }>
): Promise<PriceBreak> {
  const d = tourDateKey(date);
  const list =
    rules ??
    (await prisma.priceRule.findMany({ where: { productId: product.id, active: true } }));

  let bps = 0;
  const dow = weekdayOf(d);
  if (dow === 0 || dow === 6) bps += product.weekendRateBps;

  for (const rule of list) {
    if (!rule.active) continue;
    if (rule.dateFrom && d < tourDateKey(rule.dateFrom)) continue;
    if (rule.dateTo && d > tourDateKey(rule.dateTo)) continue;
    if (rule.weekdays) {
      try {
        const days = JSON.parse(rule.weekdays) as number[];
        if (days.length && !days.includes(dow)) continue;
      } catch {
        /* ignore malformed rule */
      }
    }
    bps += rule.surchargeBps;
  }

  const base: PriceBreak = {
    adult: option?.priceAdultCents ?? product.priceAdultCents,
    child: option?.priceChildCents ?? product.priceChildCents,
    infant: option?.priceInfantCents ?? product.priceInfantCents,
  };
  if (bps <= 0) return base;
  const bump = (c: number) => c + applyBps(c, bps);
  return { adult: bump(base.adult), child: bump(base.child), infant: bump(base.infant) };
}

// ------------------------------------------------------------
// Coupons & promotions
// ------------------------------------------------------------

export type DiscountResult = {
  discountCents: number;
  couponCode?: string;
  promotionId?: string;
  reason?: string;
};

function parseIdList(json: string | null | undefined): string[] | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? (arr as string[]) : null;
  } catch {
    return null;
  }
}

export function validateCoupon(
  coupon: Coupon | null,
  ctx: {
    subtotalCents: number;
    productId: string;
    supplierId: string;
    now?: Date;
    userUsage?: number;
  }
): { ok: true; coupon: Coupon } | { ok: false; reason: string } {
  const now = ctx.now ?? new Date();
  if (!coupon || !coupon.active) return { ok: false, reason: "Invalid coupon code" };
  if (coupon.startDate && now < coupon.startDate)
    return { ok: false, reason: "This coupon is not active yet" };
  if (coupon.endDate && now > coupon.endDate)
    return { ok: false, reason: "This coupon has expired" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, reason: "This coupon has reached its usage limit" };
  if (
    coupon.minBookingCents !== null &&
    ctx.subtotalCents < coupon.minBookingCents
  )
    return { ok: false, reason: "Minimum booking amount not reached" };
  const products = parseIdList(coupon.productIds);
  if (products && !products.includes(ctx.productId))
    return { ok: false, reason: "This coupon is not valid for this tour" };
  const suppliers = parseIdList(coupon.supplierIds);
  if (suppliers && !suppliers.includes(ctx.supplierId))
    return { ok: false, reason: "This coupon is not valid for this supplier" };
  if (coupon.perUserLimit > 0 && (ctx.userUsage ?? 0) >= coupon.perUserLimit)
    return { ok: false, reason: "You have already used this coupon" };
  return { ok: true, coupon };
}

export function couponDiscount(
  coupon: Coupon,
  subtotalCents: number
): number {
  let discount =
    coupon.type === "PERCENT"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(coupon.value, subtotalCents);
  if (coupon.maxDiscountCents !== null)
    discount = Math.min(discount, coupon.maxDiscountCents);
  return Math.max(0, Math.min(discount, subtotalCents));
}

/** Automatic promotion (early-bird / last-minute / seasonal). Best match wins. */
export function promotionDiscount(
  promotions: Promotion[],
  ctx: { subtotalCents: number; tourDate: Date; now?: Date; productId: string; supplierId: string }
): { discountCents: number; promotionId?: string } {
  const now = ctx.now ?? new Date();
  const leadDays = Math.floor(
    (tourDateKey(ctx.tourDate).getTime() - tourDateKey(now).getTime()) / 86_400_000
  );
  let best = { discountCents: 0, promotionId: undefined as string | undefined };
  for (const p of promotions) {
    if (!p.active) continue;
    if (p.dateFrom && now < p.dateFrom) continue;
    if (p.dateTo && now > p.dateTo) continue;
    if (p.leadDaysMin !== null && leadDays < p.leadDaysMin) continue;
    if (p.leadDaysMax !== null && leadDays > p.leadDaysMax) continue;
    const products = parseIdList(p.productIds);
    if (products && !products.includes(ctx.productId)) continue;
    const suppliers = parseIdList(p.supplierIds);
    if (suppliers && !suppliers.includes(ctx.supplierId)) continue;
    const discount = applyBps(ctx.subtotalCents, p.discountBps);
    if (discount > best.discountCents)
      best = { discountCents: discount, promotionId: p.id };
  }
  return best;
}

// ------------------------------------------------------------
// Commission
// ------------------------------------------------------------

/**
 * Precedence: product override → supplier override → platform default.
 * Returns the platform commission and supplier earnings for a booking total.
 */
export function commissionFor(
  totalCents: number,
  ctx: {
    product?: Pick<Product, "commissionRateBps"> | null;
    supplier?: Pick<Supplier, "commissionRateBps"> | null;
    defaultBps: number;
  }
): { rateBps: number; commissionCents: number; supplierCents: number } {
  const rateBps =
    ctx.product?.commissionRateBps ??
    ctx.supplier?.commissionRateBps ??
    ctx.defaultBps;
  const commissionCents = applyBps(totalCents, rateBps);
  return {
    rateBps,
    commissionCents,
    supplierCents: totalCents - commissionCents,
  };
}
