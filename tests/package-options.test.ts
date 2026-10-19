import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  INITIAL_VISIBLE_OPTIONS,
  fallbackTotal,
  formatPackageDate,
  guestLabel,
  ordinalDay,
  perPersonPrice,
  visibleOptions,
} from "@/lib/package-options";
import { PackageCards, type PackageOption } from "@/components/AvailableOptions";
import { formatMoney } from "@/lib/money";

const opt = (over: Partial<PackageOption> = {}): PackageOption => ({
  id: "opt-1",
  name: "All Inclusive with Budget Package",
  description: null,
  startTime: null,
  priceAdultCents: null,
  priceChildCents: null,
  priceInfantCents: null,
  ...over,
});

const counts = { adults: 1, children: 0, infants: 0, total: 1 };
const base = { adult: 850000, child: 500000, infant: 0 };

describe("package option date & label helpers", () => {
  it("formats ISO dates with ordinal days", () => {
    expect(formatPackageDate("2026-10-19")).toBe("October 19th, 2026");
    expect(formatPackageDate("2026-01-01")).toBe("January 1st, 2026");
    expect(formatPackageDate("2026-03-22")).toBe("March 22nd, 2026");
    expect(formatPackageDate("2026-07-03")).toBe("July 3rd, 2026");
    expect(formatPackageDate("2026-11-11")).toBe("November 11th, 2026");
    expect(formatPackageDate("2026-12-13")).toBe("December 13th, 2026");
  });

  it("returns empty string for missing or malformed dates", () => {
    expect(formatPackageDate("")).toBe("");
    expect(formatPackageDate("not-a-date")).toBe("");
    expect(formatPackageDate("2026-13-45")).toBe("");
  });

  it("labels guest counts", () => {
    expect(guestLabel(1)).toBe("1 guest");
    expect(guestLabel(3)).toBe("3 guests");
    expect(guestLabel(0)).toBe("1 guest");
  });

  it("builds ordinal day suffixes", () => {
    expect(ordinalDay(21)).toBe("21st");
    expect(ordinalDay(22)).toBe("22nd");
    expect(ordinalDay(23)).toBe("23rd");
    expect(ordinalDay(11)).toBe("11th");
    expect(ordinalDay(4)).toBe("4th");
  });
});

describe("package card pricing", () => {
  it("falls back from option prices to the tour base price", () => {
    expect(fallbackTotal(opt(), base, counts)).toBe(850000);
    expect(fallbackTotal(opt({ priceAdultCents: 950000 }), base, counts)).toBe(950000);
    expect(
      fallbackTotal(opt(), base, { adults: 2, children: 1, infants: 1 })
    ).toBe(2 * 850000 + 500000 + 0);
  });

  it("divides totals into a per-person price", () => {
    expect(perPersonPrice(850000, 1)).toBe(850000);
    expect(perPersonPrice(1700000, 2)).toBe(850000);
    expect(perPersonPrice(100, 0)).toBe(100);
  });

  it("collapses to the first cards until expanded", () => {
    const list = [1, 2, 3, 4].map((n) => opt({ id: `o${n}` }));
    expect(visibleOptions(list, false)).toHaveLength(INITIAL_VISIBLE_OPTIONS);
    expect(visibleOptions(list, true)).toHaveLength(4);
    expect(visibleOptions(list.slice(0, 2), false)).toHaveLength(2);
  });
});

describe("PackageCards rendering", () => {
  const render = (props: Partial<Parameters<typeof PackageCards>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(PackageCards, {
        options: [opt()],
        currency: "IDR",
        basePrices: base,
        minPax: 1,
        maxPax: 15,
        date: "2026-10-19",
        counts,
        totals: {},
        optionId: "",
        onSelect: () => {},
        ...props,
      })
    );

  it("shows the package header with guests and travel date", () => {
    const html = render();
    expect(html).toContain("Choose your package");
    expect(html).toContain("Available options");
    expect(html).toContain("1 guest");
    expect(html).toContain("October 19th, 2026");
  });

  it("renders per-person and total prices with fallback pricing", () => {
    const html = render();
    expect(html).toContain(formatMoney(850000, "IDR")); // per person + total from base price
    expect(html).toContain("Per person · 1-15 pax");
  });

  it("prefers live quote totals over the fallback", () => {
    const html = render({ totals: { "opt-1": 975000 } });
    expect(html).toContain(formatMoney(975000, "IDR"));
    expect(html).not.toContain(formatMoney(850000, "IDR"));
  });

  it("collapses to two cards with a show-all button", () => {
    const options = [1, 2, 3, 4].map((n) => opt({ id: `o${n}`, name: `Package ${n}` }));
    const html = render({ options });
    expect(html).toContain("Package 1");
    expect(html).toContain("Package 2");
    expect(html).not.toContain("Package 3");
    expect(html).toContain("Show all 4 options");
  });

  it("marks the selected package", () => {
    const html = render({ optionId: "opt-1" });
    expect(html).toContain("Selected");
    expect(html).not.toContain(">Select<");
  });
});
