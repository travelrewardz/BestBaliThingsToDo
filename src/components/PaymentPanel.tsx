"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";

const LABELS: Record<string, string> = {
  STRIPE: "Pay by card (Stripe)",
  BANK_TRANSFER: "Bank transfer",
  ONSITE: "Pay on the day",
  TEST_CARD: "Test card (dev)",
  PAYPAL: "PayPal",
  MIDTRANS: "Midtrans",
  XENDIT: "Xendit",
};

/**
 * Payment choices on the checkout page. Providers come from /api/payments,
 * so the list always matches what the deployment actually supports.
 */
export function PaymentPanel({
  bookingId,
  reference,
  awaitingPayment,
}: {
  bookingId: string;
  reference: string;
  awaitingPayment: boolean;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<{ provider: string; lines: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .then((data) => setProviders(Array.isArray(data?.providers) ? data.providers : []))
      .catch(() => setProviders([]));
  }, []);

  async function pay(provider: string) {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not start the payment.");
        return;
      }
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
        return;
      }
      setInstructions({ provider, lines: Array.isArray(data.instructions) ? data.instructions : [] });
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!awaitingPayment) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">Payment</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Choose how you&apos;d like to pay for booking {reference}.
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {instructions ? (
        <div className="mt-4">
          <Alert tone="info">
            <p className="font-bold">{LABELS[instructions.provider] ?? instructions.provider} — next steps</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {instructions.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Alert>
          <Button className="mt-4" variant="outline" onClick={() => router.refresh()}>
            I&apos;ve completed the payment
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {providers.length === 0 && <p className="text-sm text-slate-400">Loading payment options…</p>}
          {providers.map((provider) => (
            <Button
              key={provider}
              variant="outline"
              className="justify-between"
              onClick={() => void pay(provider)}
              disabled={busy !== null}
            >
              <span>{LABELS[provider] ?? provider}</span>
              <span className="text-xs text-slate-400">{busy === provider ? "Working…" : "→"}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
