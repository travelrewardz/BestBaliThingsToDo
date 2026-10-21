import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHILD_AGE_HINT,
  INITIAL_VISIBLE_OPTIONS,
  INFANT_AGE_HINT,
  fallbackTotal,
  formatPackageDate,
  fromPrice,
  guestLabel,
  optionAvailability,
  optionMaxPax,
  optionMinPax,
  ordinalDay,
  perPersonPrice,
  selectTierForPax,
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

describe("selectTierForPax", () => {
  const tiers = [
    { minPax: 1, maxPax: 2, priceCents: 900000 },
    { minPax: 3, maxPax: 5, priceCents: 800000 },
    { minPax: 6, maxPax: null, priceCents: 700000 },
  ];

  it("picks the tier covering the party size", () => {
    expect(selectTierForPax(tiers, 1)?.priceCents).toBe(900000);
    expect(selectTierForPax(tiers, 2)?.priceCents).toBe(900000);
    expect(selectTierForPax(tiers, 4)?.priceCents).toBe(800000);
    expect(selectTierForPax(tiers, 10)?.priceCents).toBe(700000); // open-ended max
  });

  it("prefers the most specific (highest minPax) match", () => {
    const overlapping = [
      { minPax: 1, maxPax: null, priceCents: 500000 },
      { minPax: 3, maxPax: 4, priceCents: 450000 },
    ];
    expect(selectTierForPax(overlapping, 3)?.priceCents).toBe(450000);
    expect(selectTierForPax(overlapping, 9)?.priceCents).toBe(500000);
  });

  it("returns null when no tier covers the party or the tier has no price", () => {
    expect(selectTierForPax(tiers, 0)).not.toBeNull(); // clamps to 1
    const bounded = [{ minPax: 2, maxPax: 4, priceCents: 100 }];
    expect(selectTierForPax(bounded, 1)).toBeNull();
    expect(selectTierForPax([], 2)).toBeNull();
    expect(selectTierForPax(null, 2)).toBeNull();
    // unfinished tier rows (price 0) never make a booking free
    expect(
      selectTierForPax([{ minPax: 1, maxPax: null, priceCents: 0 }], 2)
    ).toBeNull();
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

  it("prices from the option's tier matching the party size", () => {
    const withTiers = opt({
      priceAdultCents: 950000,
      tiers: [
        { minPax: 1, maxPax: 2, priceCents: 800000 },
        { minPax: 3, maxPax: null, priceCents: 700000 },
      ],
    });
    expect(fallbackTotal(withTiers, base, counts)).toBe(800000);
    expect(
      fallbackTotal(withTiers, base, { adults: 4, children: 0, infants: 0 })
    ).toBe(4 * 700000);
    // children/infants keep their explicit overrides when set on the option
    const childOverride = opt({
      priceChildCents: 500000,
      tiers: [{ minPax: 1, maxPax: null, priceCents: 800000 }],
    });
    expect(
      fallbackTotal(childOverride, base, { adults: 2, children: 1, infants: 0 })
    ).toBe(2 * 800000 + 500000);
  });

  it("quotes the lowest tier as the from price", () => {
    expect(fromPrice(opt(), 850000)).toBe(850000);
    expect(fromPrice(opt({ priceAdultCents: 950000 }), 850000)).toBe(950000);
    expect(
      fromPrice(
        opt({
          priceAdultCents: 950000,
          tiers: [
            { minPax: 1, maxPax: 2, priceCents: 900000 },
            { minPax: 3, maxPax: null, priceCents: 700000 },
          ],
        }),
        850000
      )
    ).toBe(700000);
    // unfinished tier rows (price 0) never advertise a free booking
    expect(fromPrice(opt({ tiers: [{ minPax: 1, maxPax: null, priceCents: 0 }] }), 850000)).toBe(
      850000
    );
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
    expect(html).toContain("Total for 1");
    // the card still advertises its cheapest tier as "from"
    expect(html).toContain(formatMoney(850000, "IDR"));
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

  it("keeps packages the party can't take visible but unselectable", () => {
    const twoPlus = opt({
      id: "opt-2",
      name: "Couples package",
      tiers: [{ minPax: 2, maxPax: 4, priceCents: 700000 }],
    });
    const html = render({ options: [opt(), twoPlus] });
    // still on the page, with its cheapest price shown…
    expect(html).toContain("Couples package");
    expect(html).toContain(formatMoney(700000, "IDR"));
    expect(html).toContain("Available for 2+ travellers — add 1 more");
    // …but not clickable
    expect(html).toContain("Not available");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('disabled=""');
  });

  it("shows a failing quote as unavailable instead of hiding the card", () => {
    const html = render({ quoteErrors: { "opt-1": "Fully booked for this date" } });
    expect(html).toContain("Fully booked for this date");
    expect(html).toContain("Not available");
    expect(html).toContain('aria-disabled="true"');
  });
});

describe("option party rules (minimum adults / tier party sizes)", () => {
  const party = (adults: number, children = 0, infants = 0) => ({
    adults,
    children,
    infants,
    total: adults + children + infants,
  });

  it("reads the party range from the option's tiers", () => {
    const tiered = opt({ tiers: [{ minPax: 2, maxPax: 4, priceCents: 700000 }] });
    expect(optionMinPax(tiered, 1)).toBe(2);
    expect(optionMaxPax(tiered, 15)).toBe(4);
    // an open-ended tier is only bounded by the tour's own maximum
    const open = opt({ tiers: [{ minPax: 6, maxPax: null, priceCents: 650000 }] });
    expect(optionMinPax(open, 1)).toBe(6);
    expect(optionMaxPax(open, 15)).toBe(15);
    // no tiers → the tour's own limits
    expect(optionMinPax(opt(), 3)).toBe(3);
    expect(optionMaxPax(opt(), 8)).toBe(8);
  });

  it("blocks options that need a bigger party without hiding them", () => {
    const twoPlus = opt({ tiers: [{ minPax: 2, maxPax: 4, priceCents: 700000 }] });
    expect(optionAvailability(twoPlus, party(1), { minAdults: 1, maxPax: 15 })).toMatchObject({
      bookable: false,
      reason: "Available for 2+ travellers — add 1 more",
    });
    expect(optionAvailability(twoPlus, party(2), { minAdults: 1, maxPax: 15 })).toMatchObject({
      bookable: true,
      reason: null,
    });
    // children and infants count towards the party size, not the adult minimum
    expect(optionAvailability(twoPlus, party(1, 1), { minAdults: 1, maxPax: 15 }).bookable).toBe(
      true
    );
  });

  it("enforces the tour minimum on adults, with children added on top", () => {
    const anyOption = opt();
    expect(optionAvailability(anyOption, party(1, 2), { minAdults: 2, maxPax: 15 })).toMatchObject({
      bookable: false,
      reason: "Needs at least 2 adults",
    });
    expect(optionAvailability(anyOption, party(2), { minAdults: 2, maxPax: 15 }).bookable).toBe(
      true
    );
  });

  it("blocks parties above the group maximum", () => {
    const capped = opt({ tiers: [{ minPax: 1, maxPax: 4, priceCents: 700000 }] });
    expect(optionAvailability(capped, party(5), { minAdults: 1, maxPax: 15 })).toMatchObject({
      bookable: false,
      reason: "Up to 4 travellers",
    });
    const open = opt({ tiers: [{ minPax: 1, maxPax: null, priceCents: 700000 }] });
    expect(optionAvailability(open, party(12), { minAdults: 1, maxPax: 15 }).bookable).toBe(true);
    expect(optionAvailability(open, party(16), { minAdults: 1, maxPax: 15 }).bookable).toBe(false);
  });

  it("uses the updated age bands for children and infants", () => {
    expect(CHILD_AGE_HINT).toBe("2–6 yrs");
    expect(INFANT_AGE_HINT).toBe("under 3 yrs");
  });
});
