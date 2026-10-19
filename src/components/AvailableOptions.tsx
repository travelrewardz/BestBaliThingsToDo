"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import {
  INITIAL_VISIBLE_OPTIONS,
  fallbackTotal,
  formatPackageDate,
  guestLabel,
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
          const selected = optionId === o.id;
          const expanded = expandedId === o.id;
          const total = totals[o.id] ?? fallbackTotal(o, basePrices, counts);
          const perPerson = perPersonPrice(total, counts.total);
          return (
            <article
              key={o.id}
              className={`flex flex-col rounded-2xl border p-5 transition-colors ${
                selected
                  ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600"
                  : "border-slate-200 bg-white"
              }`}
            >
              <h3 className="font-display text-lg font-bold text-slate-900">{o.name}</h3>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Per person · {minPax}-{maxPax} pax{o.startTime ? ` · Starts ${o.startTime}` : ""}
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
                    Per person
                  </p>
                  <p className="font-display text-xl font-extrabold text-brand-700">
                    {formatMoney(perPerson, currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Total
                  </p>
                  <p className="font-display text-xl font-extrabold text-slate-900">
                    {formatMoney(total, currency)}
                  </p>
                </div>
              </div>

              <Button
                className="mt-4 w-full uppercase tracking-wide"
                variant={selected ? "dark" : "primary"}
                onClick={() => onSelect(selected ? "" : o.id)}
              >
                {selected ? "✓ Selected" : "Select"}
              </Button>
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

  // One quote per package so each card's total matches the real price for the
  // selected date/party (weekend rates, option overrides, surcharges…).
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
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => [o.id, (d?.quote?.subtotalCents as number | undefined) ?? null] as const)
            .catch(() => [o.id, null] as const)
        )
      ).then((entries) => {
        if (!controller.signal.aborted) setTotals(Object.fromEntries(entries));
      });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [checked, productId, options, date, counts]);

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
      optionId={optionId}
      onSelect={setOptionId}
    />
  );
}
