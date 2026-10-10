/** Money helpers — all amounts are integer cents in the base currency. */

export const DEFAULT_CURRENCY = "USD";

/** Static fallback rates vs base currency (admin can override in Settings → currency). */
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  IDR: 15750,
  EUR: 0.92,
  GBP: 0.78,
  AUD: 1.52,
  SGD: 1.34,
  MYR: 4.45,
  CAD: 1.37,
};

export function convertCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}

export function formatMoney(
  cents: number,
  currency = DEFAULT_CURRENCY,
  locale = "en-US"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** "from $45" style helper for cards. */
export function formatFromPrice(cents: number, currency = DEFAULT_CURRENCY): string {
  return `from ${formatMoney(cents, currency)}`;
}

/** Basis point helpers: 1500 bps = 15%. */
export function applyBps(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10000);
}

export function parseMoneyInput(input: string | number | undefined | null): number {
  if (input === undefined || input === null || input === "") return 0;
  const n = typeof input === "number" ? input : parseFloat(String(input).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
