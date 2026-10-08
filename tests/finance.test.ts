import { describe, expect, it } from "vitest";
import type { Coupon, Promotion } from "@prisma/client";
import {
  commissionFor,
  couponDiscount,
  promotionDiscount,
  validateCoupon,
} from "@/lib/finance";

// ------------------------------------------------------------ fixtures

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: "c1",
  code: "SAVE10",
  description: "10% off",
  type: "PERCENT",
  value: 10,
  startDate: null,
  endDate: null,
  minBookingCents: null,
  maxDiscountCents: null,
  usageLimit: null,
  usedCount: 0,
  perUserLimit: 1,
  supplierIds: null,
  productIds: null,
  active: true,
  createdBy: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const ctx = (over: Partial<Parameters<typeof validateCoupon>[1]> = {}) => ({
  subtotalCents: 10_000,
  productId: "p1",
  supplierId: "s1",
  now: new Date("2026-06-01T00:00:00Z"),
  userUsage: 0,
  ...over,
});

// ------------------------------------------------------------ validateCoupon

describe("validateCoupon", () => {
  it("accepts a valid coupon", () => {
    const check = validateCoupon(coupon(), ctx());
    expect(check.ok).toBe(true);
  });

  it("rejects missing or inactive coupons", () => {
    expect(validateCoupon(null, ctx())).toEqual({
      ok: false,
      reason: "Invalid coupon code",
    });
    expect(validateCoupon(coupon({ active: false }), ctx()).ok).toBe(false);
  });

  it("rejects coupons outside their date window", () => {
    const before = validateCoupon(
      coupon({ startDate: new Date("2026-07-01T00:00:00Z") }),
      ctx()
    );
    expect(before).toMatchObject({ reason: "This coupon is not active yet" });

    const after = validateCoupon(
      coupon({ endDate: new Date("2026-05-01T00:00:00Z") }),
      ctx()
    );
    expect(after).toMatchObject({ reason: "This coupon has expired" });
  });

  it("enforces usage limits", () => {
    const global = validateCoupon(
      coupon({ usageLimit: 3, usedCount: 3 }),
      ctx()
    );
    expect(global).toMatchObject({
      reason: "This coupon has reached its usage limit",
    });

    const perUser = validateCoupon(coupon({ perUserLimit: 1 }), ctx({ userUsage: 1 }));
    expect(perUser).toMatchObject({ reason: "You have already used this coupon" });
  });

  it("enforces the minimum booking amount", () => {
    const check = validateCoupon(
      coupon({ minBookingCents: 50_000 }),
      ctx({ subtotalCents: 10_000 })
    );
    expect(check).toMatchObject({ reason: "Minimum booking amount not reached" });
  });

  it("restricts by product and supplier", () => {
    const productBound = validateCoupon(coupon({ productIds: '["other"]' }), ctx());
    expect(productBound).toMatchObject({
      reason: "This coupon is not valid for this tour",
    });

    const supplierBound = validateCoupon(coupon({ supplierIds: '["other"]' }), ctx());
    expect(supplierBound).toMatchObject({
      reason: "This coupon is not valid for this supplier",
    });

    // matching ids pass
    expect(
      validateCoupon(coupon({ productIds: '["p1"]', supplierIds: '["s1"]' }), ctx()).ok
    ).toBe(true);
  });

  it("treats malformed id lists as unrestricted", () => {
    expect(validateCoupon(coupon({ productIds: "not-json" }), ctx()).ok).toBe(true);
    expect(validateCoupon(coupon({ supplierIds: '{"a":1}' }), ctx()).ok).toBe(true);
  });
});

// ------------------------------------------------------------ couponDiscount

describe("couponDiscount", () => {
  it("computes percent discounts", () => {
    expect(couponDiscount(coupon({ type: "PERCENT", value: 10 }), 10_000)).toBe(1_000);
    expect(couponDiscount(coupon({ type: "PERCENT", value: 100 }), 10_000)).toBe(10_000);
  });

  it("caps percent discounts at maxDiscountCents", () => {
    expect(
      couponDiscount(
        coupon({ type: "PERCENT", value: 50, maxDiscountCents: 2_000 }),
        10_000
      )
    ).toBe(2_000);
  });

  it("clamps fixed discounts to the subtotal", () => {
    expect(couponDiscount(coupon({ type: "FIXED", value: 1_500 }), 10_000)).toBe(1_500);
    // discount never exceeds what's being charged
    expect(couponDiscount(coupon({ type: "FIXED", value: 50_000 }), 300)).toBe(300);
  });
});

// ------------------------------------------------------------ promotionDiscount

const promotion = (over: Partial<Promotion> = {}): Promotion => ({
  id: "promo1",
  name: "Early bird",
  type: "EARLY_BIRD",
  discountBps: 500,
  dateFrom: null,
  dateTo: null,
  leadDaysMin: null,
  leadDaysMax: null,
  supplierIds: null,
  productIds: null,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("promotionDiscount", () => {
  const pCtx = {
    subtotalCents: 10_000,
    tourDate: new Date("2026-06-10T00:00:00Z"),
    now: new Date("2026-06-01T00:00:00Z"),
    productId: "p1",
    supplierId: "s1",
  };

  it("applies a matching promotion", () => {
    const res = promotionDiscount([promotion()], pCtx);
    expect(res).toEqual({ discountCents: 500, promotionId: "promo1" });
  });

  it("picks the best (largest) discount", () => {
    const res = promotionDiscount(
      [promotion({ id: "small", discountBps: 300 }), promotion({ id: "big", discountBps: 800 })],
      pCtx
    );
    expect(res).toEqual({ discountCents: 800, promotionId: "big" });
  });

  it("respects lead-day windows", () => {
    // tour is 9 days out
    expect(
      promotionDiscount([promotion({ leadDaysMin: 14 })], pCtx).discountCents
    ).toBe(0);
    expect(
      promotionDiscount([promotion({ leadDaysMax: 30 })], pCtx).discountCents
    ).toBe(500);
    expect(
      promotionDiscount([promotion({ leadDaysMax: 5 })], pCtx).discountCents
    ).toBe(0);
  });

  it("ignores inactive or date-restricted promotions", () => {
    expect(
      promotionDiscount([promotion({ active: false })], pCtx).discountCents
    ).toBe(0);
    expect(
      promotionDiscount([promotion({ dateTo: new Date("2026-05-01T00:00:00Z") })], pCtx)
        .discountCents
    ).toBe(0);
  });
});

// ------------------------------------------------------------ commissionFor

describe("commissionFor", () => {
  it("prefers the product override, then supplier, then platform default", () => {
    expect(
      commissionFor(10_000, {
        product: { commissionRateBps: 1_200 },
        supplier: { commissionRateBps: 1_500 },
        defaultBps: 2_000,
      })
    ).toEqual({ rateBps: 1_200, commissionCents: 1_200, supplierCents: 8_800 });

    expect(
      commissionFor(10_000, {
        product: null,
        supplier: { commissionRateBps: 1_500 },
        defaultBps: 2_000,
      }).rateBps
    ).toBe(1_500);

    expect(
      commissionFor(10_000, { product: null, supplier: null, defaultBps: 2_000 }).rateBps
    ).toBe(2_000);
  });

  it("splits the total without losing cents", () => {
    const r = commissionFor(9_999, { defaultBps: 1_500 });
    expect(r.commissionCents + r.supplierCents).toBe(9_999);
    expect(r.commissionCents).toBe(1_500); // 1499.85 rounds to 1500
  });
});
