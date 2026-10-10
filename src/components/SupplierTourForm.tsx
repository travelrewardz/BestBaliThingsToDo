"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { parseMoneyInput } from "@/lib/money";

export type TourOptionRow = {
  id?: string;
  name: string;
  startTime: string;
  description: string;
  priceAdult: string;
  priceChild: string;
  priceInfant: string;
  capacityOffset: string;
  active: boolean;
};

export type TourFormValues = {
  name: string;
  slug: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  categoryId: string;
  destinationId: string;
  location: string;
  meetingPoint: string;
  pickupInfo: string;
  durationHours: string;
  durationLabel: string;
  tourType: "GROUP" | "PRIVATE";
  minParticipants: string;
  maxParticipants: string;
  difficulty: "EASY" | "MODERATE" | "CHALLENGING";
  instantConfirm: boolean;
  freeCancellation: boolean;
  familyFriendly: boolean;
  currency: string;
  priceAdult: string;
  priceChild: string;
  priceInfant: string;
  defaultCapacity: string;
  bookingCutoffHours: string;
  maxAdvanceDays: string;
  highlights: string;
  inclusions: string;
  exclusions: string;
  whatToBring: string;
  importantInfo: string;
  mediaUrls: string[];
  options: TourOptionRow[];
};

type Ref = { id: string; name: string };

const CURRENCIES = ["USD", "IDR", "EUR", "AUD", "GBP", "SGD"];

const emptyOption = (): TourOptionRow => ({
  name: "",
  startTime: "",
  description: "",
  priceAdult: "",
  priceChild: "",
  priceInfant: "",
  capacityOffset: "0",
  active: true,
});

const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Create / edit form for a supplier tour.
 * Saves via /api/supplier/tours (POST) or /api/supplier/tours/[id] (PATCH).
 */
export function SupplierTourForm({
  initial,
  categories,
  destinations,
  mode,
  tourId,
  status,
  adminNote,
}: {
  initial: TourFormValues;
  categories: Ref[];
  destinations: Ref[];
  mode: "create" | "edit";
  tourId?: string;
  status?: string;
  adminNote?: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<TourFormValues>(initial);
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const set = <K extends keyof TourFormValues>(key: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
  };

  const setOption = (index: number, patch: Partial<TourOptionRow>) =>
    setV((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));

  const canResubmit = mode === "create" || !status || ["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(status);

  async function save(submit: boolean) {
    setSaving(submit ? "submit" : "draft");
    setError(null);
    setSaved(null);
    try {
      const payload = {
        name: v.name,
        slug: v.slug || undefined,
        shortTitle: v.shortTitle || undefined,
        subtitle: v.subtitle || undefined,
        description: v.description,
        categoryId: v.categoryId || undefined,
        destinationId: v.destinationId || undefined,
        location: v.location || undefined,
        meetingPoint: v.meetingPoint || undefined,
        pickupInfo: v.pickupInfo || undefined,
        durationHours: Number(v.durationHours) || 1,
        durationLabel: v.durationLabel || undefined,
        tourType: v.tourType,
        minParticipants: Number(v.minParticipants) || 1,
        maxParticipants: Number(v.maxParticipants) || 10,
        difficulty: v.difficulty,
        instantConfirm: v.instantConfirm,
        freeCancellation: v.freeCancellation,
        familyFriendly: v.familyFriendly,
        currency: v.currency,
        priceAdultCents: parseMoneyInput(v.priceAdult),
        priceChildCents: parseMoneyInput(v.priceChild),
        priceInfantCents: parseMoneyInput(v.priceInfant),
        defaultCapacity: Number(v.defaultCapacity) || 20,
        bookingCutoffHours: Number(v.bookingCutoffHours) || 12,
        maxAdvanceDays: Number(v.maxAdvanceDays) || 180,
        highlights: lines(v.highlights),
        inclusions: lines(v.inclusions),
        exclusions: lines(v.exclusions),
        whatToBring: lines(v.whatToBring),
        importantInfo: v.importantInfo || undefined,
        options: v.options
          .filter((o) => o.name.trim())
          .map((o) => ({
            id: o.id,
            name: o.name,
            startTime: o.startTime || undefined,
            description: o.description || undefined,
            priceAdultCents: o.priceAdult ? parseMoneyInput(o.priceAdult) : undefined,
            priceChildCents: o.priceChild ? parseMoneyInput(o.priceChild) : undefined,
            priceInfantCents: o.priceInfant ? parseMoneyInput(o.priceInfant) : undefined,
            capacityOffset: Number(o.capacityOffset) || 0,
            active: o.active,
          })),
        media: v.mediaUrls.map((u) => u.trim()).filter(Boolean).map((url) => ({ url })),
        submit,
      };

      const res = await fetch(
        mode === "create" ? "/api/supplier/tours" : `/api/supplier/tours/${tourId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save this tour. Please check the form and try again.");
        return;
      }

      if (submit) {
        setSaved("Submitted for review — the admin team will publish it once approved.");
      } else {
        setSaved("Saved as draft.");
      }
      router.refresh();
      if (mode === "create") {
        router.push(`/supplier/tours/${data.tour.id}/edit`);
      }
    } catch {
      setError("Network error — your changes were not saved.");
    } finally {
      setSaving(null);
    }
  }

  const currency = v.currency;

  return (
    <div className="space-y-5 pb-24">
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}
      {(status === "CHANGES_REQUESTED" || status === "REJECTED") && adminNote && (
        <Alert tone="warning">
          <strong>Admin note:</strong> {adminNote}
        </Alert>
      )}

      <Section title="Basics" description="Name and describe your tour.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tour name" htmlFor="name" required className="sm:col-span-2">
            <Input id="name" value={v.name} onChange={set("name")} required minLength={3} maxLength={160} />
          </Field>
          <Field label="Short title" htmlFor="shortTitle" hint="Optional shorter headline for cards.">
            <Input id="shortTitle" value={v.shortTitle} onChange={set("shortTitle")} maxLength={160} />
          </Field>
          <Field label="URL slug" htmlFor="slug" hint="Leave empty to generate it from the name.">
            <Input id="slug" value={v.slug} onChange={set("slug")} maxLength={80} placeholder="ubud-atv-adventure" />
          </Field>
          <Field label="Subtitle" htmlFor="subtitle" className="sm:col-span-2">
            <Input id="subtitle" value={v.subtitle} onChange={set("subtitle")} maxLength={200} />
          </Field>
          <Field label="Category" htmlFor="categoryId">
            <Select id="categoryId" value={v.categoryId} onChange={set("categoryId")}>
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destination" htmlFor="destinationId">
            <Select id="destinationId" value={v.destinationId} onChange={set("destinationId")}>
              <option value="">— none —</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            required
            className="sm:col-span-2"
            hint="At least 20 characters. Markdown formatting is supported."
          >
            <Textarea
              id="description"
              value={v.description}
              onChange={set("description")}
              className="min-h-40"
              required
              minLength={20}
              maxLength={20000}
            />
          </Field>
        </div>
      </Section>

      <Section title="Logistics" description="Where and how the tour runs.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="location">
            <Input id="location" value={v.location} onChange={set("location")} placeholder="Ubud, Bali" />
          </Field>
          <Field label="Duration (hours)" htmlFor="durationHours" required>
            <Input
              id="durationHours"
              type="number"
              step="0.5"
              min="0.5"
              max="240"
              value={v.durationHours}
              onChange={set("durationHours")}
              required
            />
          </Field>
          <Field label="Duration label" htmlFor="durationLabel" hint="e.g. “Half day (4 hours)”.">
            <Input id="durationLabel" value={v.durationLabel} onChange={set("durationLabel")} maxLength={60} />
          </Field>
          <Field label="Tour type" htmlFor="tourType">
            <Select id="tourType" value={v.tourType} onChange={set("tourType")}>
              <option value="GROUP">Group tour</option>
              <option value="PRIVATE">Private tour</option>
            </Select>
          </Field>
          <Field label="Meeting point" htmlFor="meetingPoint">
            <Input id="meetingPoint" value={v.meetingPoint} onChange={set("meetingPoint")} />
          </Field>
          <Field label="Difficulty" htmlFor="difficulty">
            <Select id="difficulty" value={v.difficulty} onChange={set("difficulty")}>
              <option value="EASY">Easy</option>
              <option value="MODERATE">Moderate</option>
              <option value="CHALLENGING">Challenging</option>
            </Select>
          </Field>
          <Field label="Min participants" htmlFor="minParticipants">
            <Input
              id="minParticipants"
              type="number"
              min="1"
              max="200"
              value={v.minParticipants}
              onChange={set("minParticipants")}
            />
          </Field>
          <Field label="Max participants" htmlFor="maxParticipants">
            <Input
              id="maxParticipants"
              type="number"
              min="1"
              max="500"
              value={v.maxParticipants}
              onChange={set("maxParticipants")}
            />
          </Field>
          <Field label="Pickup details" htmlFor="pickupInfo" className="sm:col-span-2">
            <Textarea id="pickupInfo" value={v.pickupInfo} onChange={set("pickupInfo")} className="min-h-20" />
          </Field>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={v.instantConfirm} onChange={set("instantConfirm")} />
              Instant confirmation
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={v.freeCancellation} onChange={set("freeCancellation")} />
              Free cancellation
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={v.familyFriendly} onChange={set("familyFriendly")} />
              Family friendly
            </label>
          </div>
        </div>
      </Section>

      <Section title="Pricing" description="Base prices per person.">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Currency" htmlFor="currency">
            <Select id="currency" value={v.currency} onChange={set("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Adult price (${currency})`} htmlFor="priceAdult" required>
            <Input id="priceAdult" inputMode="decimal" value={v.priceAdult} onChange={set("priceAdult")} required />
          </Field>
          <Field label={`Child price (${currency})`} htmlFor="priceChild">
            <Input id="priceChild" inputMode="decimal" value={v.priceChild} onChange={set("priceChild")} />
          </Field>
          <Field label={`Infant price (${currency})`} htmlFor="priceInfant">
            <Input id="priceInfant" inputMode="decimal" value={v.priceInfant} onChange={set("priceInfant")} />
          </Field>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Pricing options ({v.options.length})
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setV((p) => ({ ...p, options: [...p.options, emptyOption()] }))}
            >
              + Add option
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Optional departures or ticket types (e.g. “Morning departure”). Prices fall back to the base prices above.
          </p>

          {v.options.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">No pricing options yet.</p>
          )}

          <div className="mt-3 space-y-4">
            {v.options.map((o, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Option name" htmlFor={`opt-name-${i}`} required>
                    <Input
                      id={`opt-name-${i}`}
                      value={o.name}
                      onChange={(e) => setOption(i, { name: e.target.value })}
                      placeholder="Morning departure"
                    />
                  </Field>
                  <Field label="Start time" htmlFor={`opt-time-${i}`}>
                    <Input
                      id={`opt-time-${i}`}
                      value={o.startTime}
                      onChange={(e) => setOption(i, { startTime: e.target.value })}
                      placeholder="09:00"
                    />
                  </Field>
                  <Field label={`Adult (${currency})`} htmlFor={`opt-adult-${i}`}>
                    <Input
                      id={`opt-adult-${i}`}
                      inputMode="decimal"
                      value={o.priceAdult}
                      onChange={(e) => setOption(i, { priceAdult: e.target.value })}
                    />
                  </Field>
                  <Field label={`Child (${currency})`} htmlFor={`opt-child-${i}`}>
                    <Input
                      id={`opt-child-${i}`}
                      inputMode="decimal"
                      value={o.priceChild}
                      onChange={(e) => setOption(i, { priceChild: e.target.value })}
                    />
                  </Field>
                  <Field label="Capacity offset" htmlFor={`opt-cap-${i}`} hint="Added to the default capacity (can be negative).">
                    <Input
                      id={`opt-cap-${i}`}
                      type="number"
                      value={o.capacityOffset}
                      onChange={(e) => setOption(i, { capacityOffset: e.target.value })}
                    />
                  </Field>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={o.active}
                        onChange={(e) => setOption(i, { active: e.target.checked })}
                      />
                      Active
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() =>
                        setV((p) => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Photos"
        description="Paste public image URLs (the first one is the main photo)."
      >
        <div className="space-y-3">
          {v.mediaUrls.map((url, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input
                value={url}
                onChange={(e) =>
                  setV((p) => ({
                    ...p,
                    mediaUrls: p.mediaUrls.map((u, idx) => (idx === i ? e.target.value : u)),
                  }))
                }
                placeholder="/media/tours/my-photo.webp or https://…"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() =>
                  setV((p) => ({ ...p, mediaUrls: p.mediaUrls.filter((_, idx) => idx !== i) }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setV((p) => ({ ...p, mediaUrls: [...p.mediaUrls, ""] }))}
          >
            + Add photo
          </Button>
          <p className="text-xs text-slate-500">
            File uploads are not stored on the serverless deployment yet, so use an
            already-hosted image URL (for example one from the media library or your CDN).
          </p>
        </div>
      </Section>

      <Section title="Capacity & booking window">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Default capacity" htmlFor="defaultCapacity">
            <Input
              id="defaultCapacity"
              type="number"
              min="1"
              max="1000"
              value={v.defaultCapacity}
              onChange={set("defaultCapacity")}
            />
          </Field>
          <Field label="Booking cutoff (hours)" htmlFor="bookingCutoffHours">
            <Input
              id="bookingCutoffHours"
              type="number"
              min="0"
              max="720"
              value={v.bookingCutoffHours}
              onChange={set("bookingCutoffHours")}
            />
          </Field>
          <Field label="Bookable up to (days ahead)" htmlFor="maxAdvanceDays">
            <Input
              id="maxAdvanceDays"
              type="number"
              min="1"
              max="1095"
              value={v.maxAdvanceDays}
              onChange={set("maxAdvanceDays")}
            />
          </Field>
        </div>
      </Section>

      <Section title="Content" description="One item per line — shown on the public tour page.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Highlights" htmlFor="highlights">
            <Textarea id="highlights" value={v.highlights} onChange={set("highlights")} className="min-h-28" />
          </Field>
          <Field label="What's included" htmlFor="inclusions">
            <Textarea id="inclusions" value={v.inclusions} onChange={set("inclusions")} className="min-h-28" />
          </Field>
          <Field label="Not included" htmlFor="exclusions">
            <Textarea id="exclusions" value={v.exclusions} onChange={set("exclusions")} className="min-h-28" />
          </Field>
          <Field label="What to bring" htmlFor="whatToBring">
            <Textarea id="whatToBring" value={v.whatToBring} onChange={set("whatToBring")} className="min-h-28" />
          </Field>
          <Field label="Important information" htmlFor="importantInfo" className="sm:col-span-2">
            <Textarea id="importantInfo" value={v.importantInfo} onChange={set("importantInfo")} className="min-h-24" />
          </Field>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Button type="button" variant="outline" disabled={saving !== null} onClick={() => save(false)}>
            {saving === "draft" ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
          </Button>
          {canResubmit && (
            <Button type="button" variant="dark" disabled={saving !== null} onClick={() => save(true)}>
              {saving === "submit" ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          {status && (
            <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              Current status <Badge tone="neutral">{status.replaceAll("_", " ").toLowerCase()}</Badge>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
