"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Booking state shared between the sticky BookingWidget and the
 * "Available options" package cards on the trip page: which package is
 * selected, whether the customer has checked availability (which reveals the
 * cards), and the travel date / party size both of them price against.
 *
 * The provider renders no DOM of its own, so the page layout is unaffected.
 */
export type BookingFlowValue = {
  optionId: string;
  setOptionId: (id: string) => void;
  checked: boolean;
  setChecked: (checked: boolean) => void;
  date: string;
  setDate: (date: string) => void;
  minDate: string;
  maxDate: string;
  adults: string;
  setAdults: (v: string) => void;
  children: string;
  setChildren: (v: string) => void;
  infants: string;
  setInfants: (v: string) => void;
  counts: { adults: number; children: number; infants: number; total: number };
};

const BookingFlowContext = createContext<BookingFlowValue | null>(null);

export function BookingFlowProvider({
  children,
  bookingCutoffHours,
  maxAdvanceDays,
  minParticipants,
}: {
  children: ReactNode;
  bookingCutoffHours: number;
  maxAdvanceDays: number;
  minParticipants: number;
}) {
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + Math.ceil(bookingCutoffHours / 24));
    return iso(d);
  }, [bookingCutoffHours]);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + maxAdvanceDays);
    return iso(d);
  }, [maxAdvanceDays]);

  const [optionId, setOptionId] = useState("");
  const [checked, setChecked] = useState(false);
  const [date, setDate] = useState(() => (minDate < maxDate ? minDate : ""));
  const [adults, setAdults] = useState(String(Math.max(1, minParticipants)));
  const [childInput, setChildInput] = useState("0");
  const [infantInput, setInfantInput] = useState("0");

  const counts = useMemo(() => {
    const a = Math.max(1, Number(adults) || 1);
    const c = Math.max(0, Number(childInput) || 0);
    const i = Math.max(0, Number(infantInput) || 0);
    return { adults: a, children: c, infants: i, total: a + c + i };
  }, [adults, childInput, infantInput]);

  const value = useMemo<BookingFlowValue>(
    () => ({
      optionId,
      setOptionId,
      checked,
      setChecked,
      date,
      setDate,
      minDate,
      maxDate,
      adults,
      setAdults,
      children: childInput,
      setChildren: setChildInput,
      infants: infantInput,
      setInfants: setInfantInput,
      counts,
    }),
    [optionId, checked, date, minDate, maxDate, adults, childInput, infantInput, counts]
  );

  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export function useBookingFlow(): BookingFlowValue {
  const ctx = useContext(BookingFlowContext);
  if (!ctx) throw new Error("useBookingFlow must be used inside <BookingFlowProvider>");
  return ctx;
}
