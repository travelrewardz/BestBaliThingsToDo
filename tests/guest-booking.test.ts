import { describe, expect, it } from "vitest";
import { assertMemberPromotions, BookingError } from "@/lib/bookings";

describe("member-only promotions", () => {
  it("rejects coupon codes for signed-out guests", () => {
    let caught: unknown;
    try {
      assertMemberPromotions(null, "BALI10");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BookingError);
    expect(caught).toMatchObject({ status: 400, code: "invalid_coupon" });
    expect((caught as Error).message).toMatch(/sign in/i);
  });

  it("treats a missing userId (undefined) as a guest too", () => {
    expect(() => assertMemberPromotions(undefined, "SAVE10")).toThrow(BookingError);
  });

  it("allows coupons for signed-in members", () => {
    expect(() => assertMemberPromotions("user_1", "BALI10")).not.toThrow();
  });

  it("lets guests and members quote without a coupon", () => {
    expect(() => assertMemberPromotions(null, null)).not.toThrow();
    expect(() => assertMemberPromotions(null, "")).not.toThrow();
    expect(() => assertMemberPromotions("user_1", null)).not.toThrow();
  });
});
