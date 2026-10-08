import { describe, expect, it } from "vitest";
import {
  applyBps,
  convertCents,
  formatFromPrice,
  formatMoney,
  parseMoneyInput,
} from "@/lib/money";

describe("formatMoney", () => {
  it("formats USD cents with two decimals", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(45)).toBe("$0.45");
  });

  it("formats IDR with no fraction digits", () => {
    const out = formatMoney(157500000, "IDR");
    expect(out).toMatch(/1,575,000/);
    expect(out).not.toContain(".");
  });

  it("falls back gracefully for ill-formed currency codes", () => {
    expect(formatMoney(1000, "US")).toBe("10.00 US");
  });
});

describe("formatFromPrice", () => {
  it("prefixes 'from'", () => {
    expect(formatFromPrice(4500)).toBe("from $45.00");
  });
});

describe("applyBps", () => {
  it("converts basis points (1500 bps = 15%)", () => {
    expect(applyBps(10000, 1500)).toBe(1500);
    expect(applyBps(10000, 0)).toBe(0);
    expect(applyBps(10000, 10000)).toBe(10000);
  });

  it("rounds to whole cents", () => {
    expect(applyBps(999, 1500)).toBe(150); // 149.85 → 150
  });
});

describe("convertCents", () => {
  it("applies the rate and rounds", () => {
    expect(convertCents(1000, 15750)).toBe(15750000);
    expect(convertCents(101, 1.5)).toBe(152); // 151.5 → 152
  });
});

describe("parseMoneyInput", () => {
  it("parses formatted user input into cents", () => {
    expect(parseMoneyInput("$1,234.56")).toBe(123456);
    expect(parseMoneyInput("45")).toBe(4500);
    expect(parseMoneyInput(12.34)).toBe(1234);
  });

  it("treats empty and non-numeric input as zero", () => {
    expect(parseMoneyInput(undefined)).toBe(0);
    expect(parseMoneyInput(null)).toBe(0);
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("abc")).toBe(0);
  });
});
