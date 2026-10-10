/**
 * i18n architecture. English is the initial locale; additional locales can
 * be added by extending `dictionaries` (or loading from the Translation
 * table — the schema is already in place for DB-driven translations).
 *
 * Convention: storefront-facing strings go through t(); admin & supplier
 * tooling remains English-only for now.
 */
export const locales = ["en", "fr", "de", "es", "it", "zh", "id", "ko", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.tours": "Tours",
  "nav.activities": "Activities",
  "nav.destinations": "Destinations",
  "nav.blog": "Blog",
  "nav.account": "My account",
  "nav.signin": "Sign in",
  "nav.signup": "Create account",
  "nav.signout": "Sign out",
  "nav.admin": "Admin",
  "nav.supplier": "Supplier dashboard",

  "home.hero.title": "Best Bali Things To Do",
  "home.hero.subtitle":
    "Discover Bali's best tours, activities, adventures and experiences.",
  "home.search.placeholder": "Where do you want to go?",
  "home.search.button": "Search",
  "home.categories": "Explore by category",
  "home.popular": "Popular tours",
  "home.destinations": "Popular destinations",
  "home.why": "Why book with us",
  "home.reviews": "What travelers say",
  "home.guides": "Bali travel guides",

  "tour.bookNow": "Book now",
  "tour.checkAvailability": "Check availability",
  "tour.from": "from",
  "tour.reviews": "reviews",
  "tour.duration": "Duration",
  "tour.groupSize": "Group size",
  "tour.instant": "Instant confirmation",
  "tour.freeCancellation": "Free cancellation",
  "tour.overview": "Overview",
  "tour.highlights": "Highlights",
  "tour.itinerary": "Itinerary",
  "tour.included": "What's included",
  "tour.excluded": "What's excluded",
  "tour.important": "Important information",
  "tour.bring": "What to bring",
  "tour.pickup": "Pickup information",
  "tour.availability": "Availability",
  "tour.reviews.title": "Reviews",
  "tour.faq": "FAQ",
  "tour.related": "Related tours",

  "checkout.date": "Date",
  "checkout.adults": "Adults",
  "checkout.children": "Children",
  "checkout.infants": "Infants",
  "checkout.pickup": "Pickup location",
  "checkout.option": "Tour option",
  "checkout.total": "Total",
  "checkout.continue": "Continue to checkout",
  "checkout.payNow": "Pay now",
  "checkout.payLater": "Pay later / bank transfer",
  "checkout.coupon": "Coupon code",
  "checkout.apply": "Apply",

  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.search": "Search",
  "common.price": "Price",
  "common.rating": "Rating",
};

const dictionaries: Record<string, Dict> = { en };

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[defaultLocale] || en;
  let s = dict[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

/** For future locale support in server components. */
export function tFor(locale: string, key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[locale] || dictionaries[defaultLocale] || en;
  let s = dict[key] ?? dictionaries[defaultLocale]?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}
