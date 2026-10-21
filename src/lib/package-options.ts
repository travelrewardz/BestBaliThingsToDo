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

/** Age bands shown under the guest steppers. */
export const CHILD_AGE_HINT = "2–6 yrs";
export const INFANT_AGE_HINT = "under 3 yrs";

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

/**
 * Lowest per-person price an option can ever be booked at — the figure the
 * cards advertise as "from" (its cheapest usable tier, else its own adult
 * price, else the tour's base price).
 */
export function fromPrice(option: OptionPricing, baseAdultCents: number): number {
  const tierPrices = (option.tiers ?? [])
    .filter((t) => t.priceCents > 0)
    .map((t) => t.priceCents);
  if (tierPrices.length) return Math.min(...tierPrices);
  return option.priceAdultCents ?? baseAdultCents;
}

/** Smallest party an option accepts: its lowest tier's minPax, else the tour minimum. */
export function optionMinPax(option: OptionPricing, fallbackMinPax = 1): number {
  const tierMins = (option.tiers ?? [])
    .filter((t) => t.priceCents > 0 && t.minPax > 0)
    .map((t) => t.minPax);
  const tierMin = tierMins.length ? Math.min(...tierMins) : 0;
  return Math.max(1, Math.floor(fallbackMinPax || 1), tierMin);
}

/** Largest party an option accepts: its highest tier cap, else the tour maximum. */
export function optionMaxPax(option: OptionPricing, fallbackMaxPax: number): number {
  const tiers = (option.tiers ?? []).filter((t) => t.priceCents > 0);
  // An open-ended tier (no maxPax) is bounded only by the tour's own limit.
  if (tiers.some((t) => t.maxPax == null)) return fallbackMaxPax;
  const caps = tiers
    .map((t) => t.maxPax)
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (!caps.length) return fallbackMaxPax;
  return Math.max(...caps);
}

export type PartySize = { adults: number; children: number; infants: number; total: number };

export type OptionAvailability = {
  bookable: boolean;
  /** Why the current party can't take this option (null when it can). */
  reason: string | null;
  minPax: number;
  maxPax: number;
};

/**
 * Whether the current party may book an option. Options the party can't take
 * stay on the page — dimmed and unselectable, still showing their "from"
 * price — so customers can see the cheaper packages that open up for larger
 * groups. The minimum is enforced on ADULTS (children and infants are added
 * on top of the tour's minimum), while tier caps and the group maximum apply
 * to the whole party.
 */
export function optionAvailability(
  option: OptionPricing,
  party: PartySize,
  limits: { minAdults: number; maxPax: number }
): OptionAvailability {
  const minPax = optionMinPax(option, limits.minAdults);
  const maxPax = optionMaxPax(option, limits.maxPax);
  const adults = Math.max(1, Math.floor(party.adults || 1));
  const total = Math.max(1, Math.floor(party.total || adults));

  if (adults < limits.minAdults) {
    return {
      bookable: false,
      reason: `Needs at least ${limits.minAdults} adults`,
      minPax,
      maxPax,
    };
  }
  if (total < minPax) {
    const short = minPax - total;
    return {
      bookable: false,
      reason: `Available for ${minPax}+ travellers — add ${short} more`,
      minPax,
      maxPax,
    };
  }
  if (maxPax > 0 && total > maxPax) {
    return { bookable: false, reason: `Up to ${maxPax} travellers`, minPax, maxPax };
  }
  return { bookable: true, reason: null, minPax, maxPax };
}

/** Cards shown before "Show all … options" is pressed. */
export const INITIAL_VISIBLE_OPTIONS = 2;

export function visibleOptions<T>(options: T[], showAll: boolean): T[] {
  return showAll ? options : options.slice(0, INITIAL_VISIBLE_OPTIONS);
}
