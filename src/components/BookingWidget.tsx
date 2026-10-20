"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatPackageDate, guestLabel } from "@/lib/package-options";
import { useBookingFlow } from "@/components/BookingFlow";

type OptionQuestion = {
  id: string;
  label: string;
  type: "READ_ONLY" | "TEXT" | "SELECT";
  remark: string | null;
  choices: string[];
  required: boolean;
};

type OptionRef = {
  id: string;
  name: string;
  startTime: string | null;
  priceAdultCents: number | null;
  questions?: OptionQuestion[];
};

type Quote = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  totalTravelers: number;
  discountReason?: string;
};

/**
 * Compact −/＋ counter for child & infant counts under the main Guests
 * stepper (age-based prices, so they need their own controls).
 */
function AgeStepper({
  label,
  hint,
  value,
  min,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "grid h-7 w-7 place-items-center rounded-md text-lg font-bold text-slate-600 hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold text-slate-600">
        {label} <span className="font-normal text-slate-400">· {hint}</span>
      </p>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={`Remove one ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className={btn}
        >
          −
        </button>
        <span className="text-sm font-bold text-slate-900">{value}</span>
        <button
          type="button"
          aria-label={`Add one ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(50, value + 1))}
          disabled={value >= 50}
          className={btn}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Sticky "book now" card on the tour page:
 * date + option + travellers → live price from /api/quote + seats from
 * /api/availability → sign-in (customers only) → booking created via /api/bookings.
 *
 * Date/party/option live in the shared BookingFlowProvider so the package
 * cards under Highlights stay in sync. When the tour has pricing options the
 * first action is "Check availability", which reveals those cards.
 */
export function BookingWidget({
  productId,
  slug,
  name,
  currency,
  basePriceCents,
  priceAdultCents,
  minParticipants,
  maxParticipants,
  tourType,
  options,
}: {
  productId: string;
  slug: string;
  name: string;
  currency: string;
  basePriceCents: number;
  priceAdultCents: number;
  minParticipants: number;
  maxParticipants: number;
  tourType: string;
  options: OptionRef[];
}) {
  const router = useRouter();
  const {
    optionId,
    checked,
    setChecked,
    date,
    setDate,
    minDate,
    maxDate,
    adults,
    setAdults,
    children,
    setChildren,
    infants,
    setInfants,
  } = useBookingFlow();
  const [coupon, setCoupon] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<"choose" | "details">("choose");
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", pickupLocation: "", specialRequests: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedOption = useMemo(
    () => options.find((o) => o.id === optionId),
    [options, optionId]
  );
  const optionQuestions = selectedOption?.questions ?? [];

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => {
        if (!active) return;
        const me = data?.user;
        if (me?.role === "CUSTOMER") {
          setUser({ name: me.name, email: me.email, role: me.role });
          setForm((f) => ({ ...f, customerName: f.customerName || me.name || "" }));
        } else if (me) {
          setUser({ name: me.name, email: me.email, role: me.role });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      const adultsN = Math.max(1, Number(adults) || 1);
      const childrenN = Math.max(0, Number(children) || 0);
      const infantsN = Math.max(0, Number(infants) || 0);
      const payload = {
        productId,
        optionId: optionId || null,
        date,
        adults: adultsN,
        children: childrenN,
        infants: infantsN,
        couponCode: coupon.trim() || null,
      };
      Promise.all([
        fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) })),
        fetch(`/api/availability?productId=${encodeURIComponent(productId)}&date=${date}`, {
          signal: controller.signal,
        }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) })),
      ])
        .then(([q, a]) => {
          if (controller.signal.aborted) return;
          if (q.ok && q.data?.quote) {
            setQuote(q.data.quote as Quote);
            setError(null);
          } else {
            setQuote(null);
            setError(q.data?.error?.message ?? null);
          }
          setRemaining(a.ok && typeof a.data?.remaining === "number" ? a.data.remaining : null);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [productId, optionId, date, adults, children, infants, coupon]);

  const total = adultsN() + childrenN() + infantsN();
  function adultsN() {
    return Math.max(1, Number(adults) || 1);
  }
  function childrenN() {
    return Math.max(0, Number(children) || 0);
  }
  function infantsN() {
    return Math.max(0, Number(infants) || 0);
  }

  const overCapacity = tourType === "GROUP" && total > maxParticipants;
  const underMinimum = total < minParticipants;
  const soldOut = remaining !== null && remaining <= 0;
  const canBook =
    Boolean(date) && !error && !loading && quote !== null && !overCapacity && !underMinimum && !soldOut;

  const display = (cents: number) => formatMoney(cents, quote?.currency || currency);

  // Tours with pricing options reveal the "Choose your package" cards under
  // Highlights on the first press; everything without options books directly.
  const needsCheck = options.length > 0 && !checked;

  function checkAvailability() {
    setChecked(true);
  }

  function startBooking() {
    if (!user) {
      router.push(`/login?next=/trip/${encodeURIComponent(slug)}`);
      return;
    }
    if (user.role !== "CUSTOMER") {
      setError("Only customer accounts can book tours. Sign in with a customer account.");
      return;
    }
    setStep("details");
    setError(null);
  }

  async function confirmBooking() {
    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      setError("Please enter the lead traveller's name.");
      return;
    }
    const missing = optionQuestions.find(
      (q) =>
        (q.type === "TEXT" || q.type === "SELECT") && q.required && !(answers[q.id] ?? "").trim()
    );
    if (missing) {
      setError(`Please answer "${missing.label}" — it is required for this option.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          optionId: optionId || null,
          date,
          adults: adultsN(),
          children: childrenN(),
          infants: infantsN(),
          customerName: form.customerName,
          customerEmail: user?.email ?? "",
          customerPhone: form.customerPhone || null,
          pickupLocation: form.pickupLocation || null,
          specialRequests: form.specialRequests || null,
          answers: optionQuestions
            .map((q) => ({
              questionId: q.id,
              label: q.label,
              type: q.type,
              value: q.type === "READ_ONLY" ? (q.remark ?? "") : (answers[q.id] ?? "").trim(),
            }))
            .filter((a) => a.type === "READ_ONLY" || a.value),
          couponCode: coupon.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "We could not create the booking. Please try again.");
        return;
      }
      router.push(data.redirect || `/checkout/${data.id}`);
    } catch {
      setError("Network error — your booking was not created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
            From
          </p>
          <p className="font-display text-2xl font-extrabold text-brand-800">
            {display(basePriceCents)}
            {priceAdultCents > basePriceCents && (
              <span className="ml-2 text-sm font-semibold text-slate-400 line-through">
                {display(priceAdultCents)}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">per pax · lowest tier</p>
        </div>
        {loading && <span className="shrink-0 text-xs text-slate-400">Updating…</span>}
      </div>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        <div>
          <label
            htmlFor="bw-date"
            className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-slate-700"
          >
            Travel date<span className="text-red-500"> *</span>
          </label>
          <Input
            id="bw-date"
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          {date && (
            <p className="mt-1 text-xs font-semibold text-brand-700">
              {formatPackageDate(date)}
            </p>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-slate-700">
            Guests
          </span>
          <div className="flex items-center justify-between rounded-xl border border-slate-300 px-2 py-1.5">
            <button
              type="button"
              aria-label="Remove one adult"
              onClick={() => setAdults(String(Math.max(1, adultsN() - 1)))}
              disabled={adultsN() <= 1}
              className="grid h-9 w-9 place-items-center rounded-lg text-xl font-bold text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              −
            </button>
            <span className="text-sm font-bold text-slate-900">{guestLabel(total)}</span>
            <button
              type="button"
              aria-label="Add one adult"
              onClick={() => setAdults(String(Math.min(50, adultsN() + 1)))}
              disabled={adultsN() >= 50}
              className="grid h-9 w-9 place-items-center rounded-lg text-xl font-bold text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              +
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <AgeStepper
              label="Children"
              hint="3–12 yrs"
              value={childrenN()}
              min={0}
              onChange={(v) => setChildren(String(v))}
            />
            <AgeStepper
              label="Infants"
              hint="< 3 yrs"
              value={infantsN()}
              min={0}
              onChange={(v) => setInfants(String(v))}
            />
          </div>
          {minParticipants > 1 && (
            <p className="mt-1.5 text-xs text-slate-500">
              Minimum {minParticipants} traveller{minParticipants === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <Field label="Coupon code" htmlFor="bw-coupon" hint="Optional">
          <Input
            id="bw-coupon"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            placeholder="BALI10"
          />
        </Field>
      </div>

      {remaining !== null && (
        <p className={`mt-3 text-xs font-semibold ${soldOut ? "text-red-600" : remaining <= 5 ? "text-amber-600" : "text-emerald-600"}`}>
          {soldOut ? "Fully booked for this date" : `${remaining} seat${remaining === 1 ? "" : "s"} left`}
        </p>
      )}

      {quote && (
        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <dt>
              Subtotal ({quote.totalTravelers} traveller{quote.totalTravelers === 1 ? "" : "s"})
            </dt>
            <dd>{display(quote.subtotalCents)}</dd>
          </div>
          {quote.discountCents > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <dt>Discount{quote.discountReason ? ` · ${quote.discountReason}` : ""}</dt>
              <dd>−{display(quote.discountCents)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-extrabold text-slate-900">
            <dt>Total</dt>
            <dd>{display(quote.totalCents)}</dd>
          </div>
        </dl>
      )}

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {overCapacity && (
        <div className="mt-3">
          <Alert tone="warning">This tour takes a maximum of {maxParticipants} travellers.</Alert>
        </div>
      )}
      {underMinimum && !overCapacity && (
        <div className="mt-3">
          <Alert tone="warning">Minimum {minParticipants} traveller(s) for this tour.</Alert>
        </div>
      )}

      {step === "choose" ? (
        <>
          <Button
            className="mt-4 w-full uppercase tracking-wide"
            size="lg"
            onClick={needsCheck ? checkAvailability : startBooking}
            disabled={!canBook}
          >
            {needsCheck ? "Check availability" : user ? "Book now" : "Sign in to book"}
          </Button>
          <p className="mt-2.5 text-center text-xs text-slate-400">
            Payment after confirmation
          </p>
        </>
      ) : (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-display font-bold text-slate-900">Traveller details</h3>
          <Field label="Lead traveller" htmlFor="bw-name" required>
            <Input
              id="bw-name"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Email" htmlFor="bw-email" hint="Your booking confirmation is sent here.">
            <Input id="bw-email" value={user?.email ?? ""} readOnly className="bg-slate-50" />
          </Field>
          <Field label="Phone / WhatsApp" htmlFor="bw-phone" hint="Optional">
            <Input
              id="bw-phone"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              maxLength={30}
            />
          </Field>
          <Field label="Pickup location" htmlFor="bw-pickup" hint="Hotel name or address, if pickup is offered.">
            <Input
              id="bw-pickup"
              value={form.pickupLocation}
              onChange={(e) => setForm((f) => ({ ...f, pickupLocation: e.target.value }))}
              maxLength={120}
            />
          </Field>
          <Field label="Special requests" htmlFor="bw-notes" hint="Optional">
            <Textarea
              id="bw-notes"
              value={form.specialRequests}
              onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
              maxLength={1000}
              className="min-h-20"
            />
          </Field>
          {optionQuestions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Additional info
              </h4>
              {optionQuestions.map((q) =>
                q.type === "READ_ONLY" ? (
                  <p key={q.id} className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold">{q.label}</span>
                    {q.remark && <span className="text-slate-600"> — {q.remark}</span>}
                  </p>
                ) : q.type === "SELECT" ? (
                  <Field
                    key={q.id}
                    label={q.label}
                    htmlFor={`bw-q-${q.id}`}
                    required={q.required}
                    hint={q.remark || undefined}
                    className="mt-2"
                  >
                    <Select
                      id={`bw-q-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    >
                      <option value="">Pick an option…</option>
                      {q.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field
                    key={q.id}
                    label={q.label}
                    htmlFor={`bw-q-${q.id}`}
                    required={q.required}
                    hint={q.remark || undefined}
                    className="mt-2"
                  >
                    <Input
                      id={`bw-q-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      maxLength={500}
                    />
                  </Field>
                )
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void confirmBooking()} disabled={submitting || !canBook}>
              {submitting ? "Booking…" : `Confirm booking${quote ? ` · ${display(quote.totalCents)}` : ""}`}
            </Button>
            <Button variant="ghost" onClick={() => setStep("choose")} disabled={submitting}>
              Back
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-1 text-xs text-slate-500">
        <li>🔒 Secure booking — you only pay after choosing a payment method</li>
        <li>⚡ Instant confirmation on most tours</li>
        <li>🗓️ Free cancellation on eligible tours</li>
      </ul>
      <p className="mt-2 truncate text-xs text-slate-400" title={name}>
        {name}
      </p>
    </aside>
  );
}
