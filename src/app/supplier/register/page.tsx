import type { Metadata } from "next";
import { SupplierRegisterForm } from "@/components/SupplierRegisterForm";

export const metadata: Metadata = { title: "Become a supplier", robots: { index: false } };

export default function SupplierRegisterPage() {
  return (
    <div className="bg-brand-900 px-4 py-14">
      <div className="mx-auto mb-8 max-w-3xl text-center text-white">
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          Sell your tours on Bali Things To Do
        </h1>
        <p className="mt-3 text-brand-200">
          Join our marketplace: reach thousands of travelers, manage your own listings,
          availability and bookings — with transparent commissions from 10%.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold">
          {["Free to join", "You set prices & availability", "Payouts every week", "Isolated supplier dashboard"].map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-3 py-1.5">✓ {t}</span>
          ))}
        </div>
      </div>
      <SupplierRegisterForm />
    </div>
  );
}
