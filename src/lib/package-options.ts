/**
 * Pure helpers for the "Available options / Choose your package" cards on the
 * trip page. Kept free of React so they can be unit-tested directly.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 21 → "21st"… */
export function ordinalDay(day: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = day % 100;
  return `${day}${suffixes[(mod100 - 20) % 10] ?? suffixes[mod100] ?? suffixes[0]}`;
}

/** "2026-10-19" → "October 19th, 2026" ("" when the value isn't a date). */
export function formatPackageDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = MONTHS[month - 1];
  if (!monthName || day < 1 || day > 31) return "";
  return `${monthName} ${ordinalDay(day)}, ${year}`;
}

/** 1 → "1 guest", 3 → "3 guests". */
export function guestLabel(totalTravelers: number): string {
  const n = Math.max(1, Math.floor(totalTravelers || 1));
  return `${n} guest${n === 1 ? "" : "s"}`;
}

export type OptionPricing = {
  priceAdultCents: number | null;
  priceChildCents: number | null;
  priceInfantCents: number | null;
  tiers?: { minPax: number; maxPax: number | null; priceCents: number }[] | null;
};

/**
 * The tier that applies to a party of `pax` people: the matching tier with the
 * highest minPax (most specific fit), or null when no tier covers the party
 * size. Tiers without a usable price (<= 0) are ignored so an unfinished tier
 * row can never make a booking free.
 */
export function selectTierForPax<T extends { minPax: number; maxPax: number | null; priceCents: number }>(
  tiers: T[] | null | undefined,
  pax: number
): T | null {
  if (!tiers?.length) return null;
  const n = Math.max(1, Math.floor(pax || 1));
  let best: T | null = null;
  for (const tier of tiers) {
    if (!(tier.priceCents > 0)) continue;
    if (n < tier.minPax) continue;
    if (tier.maxPax != null && n > tier.maxPax) continue;
    if (!best || tier.minPax > best.minPax) best = tier;
  }
  return best;
}

export type TravelerCounts = { adults: number; children: number; infants: number };

/**
 * List-price total for a package while the live quote is loading (or after it
 * fails): the option's matching price tier wins, then the option's own prices,
 * then the tour's base prices.
 */
export function fallbackTotal(
  option: OptionPricing,
  base: { adult: number; child: number; infant: number },
  counts: TravelerCounts
): number {
  const tier = selectTierForPax(option.tiers, counts.adults + counts.children + counts.infants);
  if (tier) {
    return (
      counts.adults * tier.priceCents +
      counts.children * (option.priceChildCents ?? tier.priceCents) +
      counts.infants * (option.priceInfantCents ?? tier.priceCents)
    );
  }
  return (
    counts.adults * (option.priceAdultCents ?? base.adult) +
    counts.children * (option.priceChildCents ?? base.child) +
    counts.infants * (option.priceInfantCents ?? base.infant)
  );
}

/** "Per person" figure on a card: the quote total divided by the party size. */
export function perPersonPrice(totalCents: number, totalTravelers: number): number {
  const travelers = Math.max(1, Math.floor(totalTravelers || 1));
  return Math.round(totalCents / travelers);
}

/** Cards shown before "Show all … options" is pressed. */
export const INITIAL_VISIBLE_OPTIONS = 2;

export function visibleOptions<T>(options: T[], showAll: boolean): T[] {
  return showAll ? options : options.slice(0, INITIAL_VISIBLE_OPTIONS);
}
