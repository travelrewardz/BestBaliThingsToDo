"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import {
  INITIAL_VISIBLE_OPTIONS,
  fallbackTotal,
  formatPackageDate,
  fromPrice,
  guestLabel,
  optionAvailability,
  perPersonPrice,
  visibleOptions,
} from "@/lib/package-options";
import { useBookingFlow } from "@/components/BookingFlow";

export type PackageOption = {
  id: string;
  name: string;
  description: string | null;
  startTime: string | null;
  priceAdultCents: number | null;
  priceChildCents: number | null;
  priceInfantCents: number | null;
  tiers?: { minPax: number; maxPax: number | null; priceCents: number }[] | null;
};

export type PackageCounts = {
  adults: number;
  children: number;
  infants: number;
  total: number;
};

/**
 * Presentational "Choose your package" card grid — no booking context, so it
 * can be rendered directly in tests. The wrapper below wires it to the shared
 * booking flow (selected option, travel date, party size, live quotes).
 */
export function PackageCards({
  options,
  currency,
  basePrices,
  minPax,
  maxPax,
  date,
  counts,
  totals,
  quoteErrors,
  optionId,
  onSelect,
}: {
  options: PackageOption[];
  currency: string;
  basePrices: { adult: number; child: number; infant: number };
  minPax: number;
  maxPax: number;
  date: string;
  counts: PackageCounts;
  totals: Record<string, number | null>;
  /** Quote failures per option (sold out, closed date…) — makes the card unbookable. */
  quoteErrors?: Record<string, string | null>;
  optionId: string;
  onSelect: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const prettyDate = formatPackageDate(date);
  const visible = visibleOptions(options, showAll);

  return (
    <section
      id="available-options"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      aria-label="Available options"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
            Available options
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-900">
            Choose your package
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Prices shown for{" "}
            <span className="font-semibold text-slate-700">{guestLabel(counts.total)}</span>
            {prettyDate && (
              <>
                {" · "}
                <span className="font-semibold text-slate-700">{prettyDate}</span>
              </>
            )}
          </p>
        </div>
        {options.length > INITIAL_VISIBLE_OPTIONS && (
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer options" : `Show all ${options.length} options`}
          </Button>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {visible.map((o) => {
          // Options the party can't take stay visible (dimmed, unselectable) so
          // the cheaper "from" prices that need a bigger group are still seen.
          const availability = optionAvailability(o, counts, { minAdults: minPax, maxPax });
          const quotedError = quoteErrors?.[o.id] ?? null;
          const bookable = availability.bookable && !quotedError;
          const reason = availability.reason ?? quotedError;
          const selected = bookable && optionId === o.id;
          const expanded = expandedId === o.id;
          const total = totals[o.id] ?? fallbackTotal(o, basePrices, counts);
          const perPerson = perPersonPrice(total, counts.total);
          const from = fromPrice(o, basePrices.adult);
          return (
            <article
              key={o.id}
              role="group"
              aria-disabled={!bookable}
              className={`flex flex-col rounded-2xl border p-5 transition-colors ${
                selected
                  ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600"
                  : bookable
                    ? "border-slate-200 bg-white"
                    : "border-dashed border-slate-300 bg-slate-50"
              }`}
            >
              <div className={bookable ? "flex flex-1 flex-col" : "flex flex-1 flex-col opacity-60"}>
              <h3 className="font-display text-lg font-bold text-slate-900">{o.name}</h3>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Per person · {availability.minPax}-{availability.maxPax} pax
                {o.startTime ? ` · Starts ${o.startTime}` : ""}
              </p>

              {o.description && (
                <p
                  className={`mt-2 text-sm text-slate-600 ${
                    o.description.length > 110 && !expanded ? "line-clamp-2" : ""
                  }`}
                >
                  {o.description}
                </p>
              )}
              {o.description && o.description.length > 110 && (
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                  className="mt-1 self-start text-xs font-bold text-brand-700 hover:text-brand-800"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}

              <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    From
                  </p>
                  <p className="font-display text-xl font-extrabold text-brand-700">
                    {formatMoney(from, currency)}
                  </p>
                  <p className="text-[11px] text-slate-400">per person</p>
                </div>
                {bookable ? (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Total for {counts.total}
                    </p>
                    <p className="font-display text-xl font-extrabold text-slate-900">
                      {formatMoney(total, currency)}
                    </p>
                    {perPerson !== from && (
                      <p className="text-[11px] text-slate-400">
                        {formatMoney(perPerson, currency)} / person
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              {bookable ? (
                <Button
                  className="mt-4 w-full uppercase tracking-wide"
                  variant={selected ? "dark" : "primary"}
                  onClick={() => onSelect(selected ? "" : o.id)}
                >
                  {selected ? "✓ Selected" : "Select"}
                </Button>
              ) : (
                <>
                  <p className="mt-3 text-[11px] font-semibold text-amber-700">{reason}</p>
                  <Button
                    className="mt-2 w-full cursor-not-allowed uppercase tracking-wide"
                    variant="ghost"
                    disabled
                  >
                    Not available
                  </Button>
                </>
              )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * "Available options / Choose your package" section under Highlights.
 *
 * Hidden until the customer presses "Check availability" in the booking
 * widget (shared state via BookingFlowProvider). Each card shows the package
 * name, price per person and the total for the current travel date & party —
 * totals come from one /api/quote per package so weekend rates and option
 * price overrides are reflected, falling back to list prices while loading or
 * when a quote fails.
 */
export function AvailableOptions({
  productId,
  options,
  currency,
  basePrices,
  minPax,
  maxPax,
}: {
  productId: string;
  options: PackageOption[];
  currency: string;
  basePrices: { adult: number; child: number; infant: number };
  minPax: number;
  maxPax: number;
}) {
  const { checked, optionId, setOptionId, date, counts } = useBookingFlow();
  const [totals, setTotals] = useState<Record<string, number | null>>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string | null>>({});

  // One quote per package so each card's total matches the real price for the
  // selected date/party (weekend rates, option overrides, surcharges…). A
  // failing quote (sold out, wrong party size, closed date) marks the card as
  // not bookable instead of dropping it from the page.
  useEffect(() => {
    if (!checked || options.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      Promise.all(
        options.map((o) =>
          fetch("/api/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              productId,
              optionId: o.id,
              date,
              adults: counts.adults,
              children: counts.children,
              infants: counts.infants,
            }),
          })
            .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
            .then(({ ok, d }) => [
              o.id,
              (d?.quote?.subtotalCents as number | undefined) ?? null,
              ok ? null : ((d?.error?.message as string | undefined) ?? "Not available for this group"),
            ] as const)
            .catch(() => [o.id, null, "Not available for this group"] as const)
        )
      ).then((entries) => {
        if (controller.signal.aborted) return;
        setTotals(Object.fromEntries(entries.map(([id, total]) => [id, total])));
        setQuoteErrors(Object.fromEntries(entries.map(([id, , error]) => [id, error])));
      });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [checked, productId, options, date, counts]);

  // Never leave a selected package selected when the party can no longer take
  // it (e.g. the customer drops back to one traveller on a 2+ package).
  useEffect(() => {
    if (!optionId) return;
    const selected = options.find((o) => o.id === optionId);
    if (!selected) return;
    if (!optionAvailability(selected, counts, { minAdults: minPax, maxPax }).bookable) {
      setOptionId("");
    }
  }, [optionId, options, counts, minPax, maxPax, setOptionId]);

  // Bring the freshly revealed section into view (it sits under Highlights,
  // above the sticky widget on desktop, well above it on mobile).
  useEffect(() => {
    if (!checked) return;
    const el = document.getElementById("available-options");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [checked]);

  if (!checked || options.length === 0) return null;

  return (
    <PackageCards
      options={options}
      currency={currency}
      basePrices={basePrices}
      minPax={minPax}
      maxPax={maxPax}
      date={date}
      counts={counts}
      totals={totals}
      quoteErrors={quoteErrors}
      optionId={optionId}
      onSelect={setOptionId}
    />
  );
}
