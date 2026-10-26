"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { RichTextEditor } from "@/components/RichTextEditor";
import { OptionEditorModal } from "@/components/OptionEditorModal";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { CURRENCIES } from "@/lib/tour-schema";

export type TourTierRow = {
  id?: string;
  label: string;
  minPax: string;
  maxPax: string;
  price: string;
};

/** One "additional info" booking question attached to a pricing option. */
export type TourQuestionRow = {
  id?: string;
  label: string;
  type: "READ_ONLY" | "TEXT" | "SELECT";
  remark: string;
  /** Options for SELECT questions (one per line in the UI). */
  choices: string;
  required: boolean;
};

export type TourOptionRow = {
  id?: string;
  name: string;
  startTime: string;
  description: string;
  priceAdult: string;
  priceChild: string;
  priceInfant: string;
  capacityOffset: string;
  agentNet: string; // percent, e.g. "10" = 10% agent/member discount
  active: boolean;
  tiers: TourTierRow[];
  questions: TourQuestionRow[];
};

export type DestinationLinkRow = { id: string; regions: string }; // regions: comma separated in the UI
export type ItineraryRow = { time: string; title: string; text: string };
export type FaqRow = { q: string; a: string };

export type TourFormValues = {
  // General
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  destinationLinks: DestinationLinkRow[];
  categoryLinks: string[];
  tripLength: "DAY" | "MULTIDAY";
  location: string;
  meetingPoint: string;
  pickupInfo: string;
  durationHours: string;
  durationLabel: string;
  difficulty: "EASY" | "MODERATE" | "CHALLENGING";
  minParticipants: string;
  maxParticipants: string;
  tourType: "GROUP" | "PRIVATE";
  instantConfirm: boolean;
  freeCancellation: boolean;
  familyFriendly: boolean;
  // Highlights & itinerary
  highlights: string;
  inclusions: string;
  exclusions: string;
  whatToBring: string;
  importantInfo: string;
  itinerary: ItineraryRow[];
  faq: FaqRow[];
  // Pricing & availability
  currency: string;
  priceAdult: string;
  priceChild: string;
  priceInfant: string;
  defaultCapacity: string;
  bookingCutoffHours: string;
  maxAdvanceDays: string;
  options: TourOptionRow[];
  mediaUrls: string[];
};

type Ref = { id: string; name: string };
type DestinationRef = { id: string; name: string; region?: string | null };

type TabId = "general" | "content" | "pricing";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "general", label: "General", hint: "Titles, descriptions, destinations, categories & SEO" },
  { id: "content", label: "Highlights & Itinerary", hint: "Highlights, inclusions, FAQ and day-by-day itinerary" },
  { id: "pricing", label: "Pricing & Availability", hint: "Base price, pricing options, tiers & capacity" },
];

const emptyOption = (): TourOptionRow => ({
  name: "",
  startTime: "",
  description: "",
  priceAdult: "",
  priceChild: "",
  priceInfant: "",
  capacityOffset: "0",
  agentNet: "",
  active: true,
  tiers: [],
  questions: [],
});


const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const csv = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
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
 * Create / edit form for a supplier tour, organised in three tabs:
 * General · Highlights & Itinerary · Pricing & Availability.
 */
export function SupplierTourForm({
  initial,
  categories,
  activities,
  destinations,
  mode,
  tourId,
  status,
  adminNote,
  preferredCurrency,
}: {
  initial: TourFormValues;
  categories: Ref[];
  activities: Ref[];
  destinations: DestinationRef[];
  mode: "create" | "edit";
  tourId?: string;
  status?: string;
  adminNote?: string | null;
  preferredCurrency?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("general");
  const [v, setV] = useState<TourFormValues>(initial);
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoryList, setCategoryList] = useState<Ref[]>(categories);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [activityList, setActivityList] = useState<Ref[]>(activities);
  const [newActivity, setNewActivity] = useState("");
  const [addingActivity, setAddingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  /** Once the supplier picks a trip length manually, duration changes stop overwriting it. */
  const [tripLengthTouched, setTripLengthTouched] = useState(false);

  const set = <K extends keyof TourFormValues>(key: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
  };

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const queue = Array.from(files);
    setUploadError(null);
    setUploading(queue.length);
    try {
      const uploaded: string[] = [];
      for (const file of queue) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("subdir", "tours");
        const res = await fetch("/api/supplier/uploads", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({} as { error?: { message?: string }; url?: string }));
        if (!res.ok || !data.url) {
          throw new Error(data?.error?.message ?? `Could not upload ${file.name}.`);
        }
        uploaded.push(data.url);
        setUploading(queue.length - uploaded.length);
      }
      setV((p) => ({ ...p, mediaUrls: [...p.mediaUrls.filter(Boolean), ...uploaded] }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed — please retry.");
    } finally {
      setUploading(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Pricing options open in a modal so the page stays short — the draft is
  // edited in isolation and only committed on Save.
  const [editing, setEditing] = useState<{
    index: number;
    isNew: boolean;
    draft: TourOptionRow;
  } | null>(null);

  const saveOptionDraft = () => {
    if (!editing) return;
    setV((prev) => {
      const options = [...prev.options];
      if (editing.isNew) {
        options.push(editing.draft);
      } else if (editing.index < options.length) {
        options[editing.index] = editing.draft;
      }
      return { ...prev, options };
    });
    setEditing(null);
  };

  const setItinerary = (index: number, patch: Partial<ItineraryRow>) =>
    setV((prev) => ({
      ...prev,
      itinerary: prev.itinerary.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));

  const setFaq = (index: number, patch: Partial<FaqRow>) =>
    setV((prev) => ({ ...prev, faq: prev.faq.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));

  const toggleCategory = (id: string) =>
    setV((prev) => ({
      ...prev,
      categoryLinks: prev.categoryLinks.includes(id)
        ? prev.categoryLinks.filter((c) => c !== id)
        : [...prev.categoryLinks, id],
    }));

  /**
   * Adds a category or activity from the tour form (reuses an existing row on a
   * name match within the same kind) and selects it on this tour.
   */
  async function addRef(kind: "CATEGORY" | "ACTIVITY") {
    const isActivity = kind === "ACTIVITY";
    const label = isActivity ? "activity" : "category";
    const name = (isActivity ? newActivity : newCategory).trim();
    const setError = isActivity ? setActivityError : setCategoryError;
    if (name.length < 2) {
      setError(`Type a ${label} name (at least 2 characters).`);
      return;
    }
    if (isActivity) setAddingActivity(true);
    else setAddingCategory(true);
    setError(null);
    try {
      const res = await fetch("/api/supplier/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      });
      const data = await res.json().catch(() => ({} as { error?: { message?: string }; category?: Ref }));
      if (!res.ok || !data.category) {
        setError(data?.error?.message ?? `Could not add this ${label}.`);
        return;
      }
      const added = data.category;
      if (isActivity) {
        setActivityList((prev) => (prev.some((a) => a.id === added.id) ? prev : [...prev, added]));
      } else {
        setCategoryList((prev) => (prev.some((c) => c.id === added.id) ? prev : [...prev, added]));
      }
      setV((prev) =>
        prev.categoryLinks.includes(added.id)
          ? prev
          : { ...prev, categoryLinks: [...prev.categoryLinks, added.id] }
      );
      if (isActivity) setNewActivity("");
      else setNewCategory("");
      setSaved(null);
    } catch {
      setError(`Network error — the ${label} was not added.`);
    } finally {
      if (isActivity) setAddingActivity(false);
      else setAddingCategory(false);
    }
  }

  const addCategory = () => addRef("CATEGORY");
  const addActivity = () => addRef("ACTIVITY");

  const pricePreview = useMemo(() => {
    const cents = (s: string) => (s.trim() ? parseMoneyInput(s) : 0);
    const base = cents(v.priceAdult);
    const tierPrices = v.options.flatMap((o) => [
      ...o.tiers.map((t) => cents(t.price)),
      cents(o.priceAdult),
    ]);
    const positive = tierPrices.filter((p) => p > 0);
    const effective = positive.length ? Math.min(...positive) : base;
    return { base, effective, currency: v.currency };
  }, [v.options, v.priceAdult, v.currency]);

  const canResubmit =
    mode === "create" || !status || ["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(status);

  function validate(): string | null {
    if (!v.name.trim() || v.name.trim().length < 3) return "Please add a tour title (at least 3 characters).";
    if (v.shortDescription.trim().length < 10)
      return "Please add a short description of at least 10 characters.";
    if (v.description.trim().length < 20)
      return "Please add a full description of at least 20 characters.";
    const min = Number(v.minParticipants) || 1;
    const max = Number(v.maxParticipants) || 1;
    if (max < min) return "Max pax must be at least the minimum.";
    return null;
  }

  async function save(submit: boolean) {
    const problem = validate();
    if (problem) {
      setError(problem);
      setSaved(null);
      return;
    }
    setSaving(submit ? "submit" : "draft");
    setError(null);
    setSaved(null);
    try {
      const payload = {
        name: v.name,
        slug: v.slug || undefined,
        shortDescription: v.shortDescription,
        description: v.description,
        seoTitle: v.seoTitle || undefined,
        seoDescription: v.seoDescription || undefined,
        seoKeywords: v.seoKeywords || undefined,
        destinationLinks: v.destinationLinks
          .filter((d) => d.id)
          .map((d) => ({ id: d.id, regions: csv(d.regions) })),
        categoryLinks: v.categoryLinks,
        tripLength: v.tripLength,
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
        itinerary: v.itinerary
          .filter((r) => r.title.trim())
          .map((r) => ({ time: r.time || undefined, title: r.title, text: r.text || undefined })),
        faq: v.faq.filter((r) => r.q.trim() && r.a.trim()).map((r) => ({ q: r.q, a: r.a })),
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
            agentNetBps: o.agentNet.trim() ? Math.round(Number(o.agentNet) * 100) : null,
            active: o.active,
            tiers: o.tiers
              .filter((t) => t.label.trim())
              .map((t) => ({
                id: t.id,
                label: t.label,
                minPax: Number(t.minPax) || 1,
                maxPax: t.maxPax.trim() ? Number(t.maxPax) : null,
                priceCents: parseMoneyInput(t.price),
              })),
            questions: o.questions
              .filter((q) => q.label.trim())
              .map((q) => ({
                id: q.id,
                label: q.label,
                type: q.type,
                remark: q.remark.trim() || undefined,
                choices: lines(q.choices),
                required: q.type === "TEXT" || q.type === "SELECT" ? q.required : false,
              })),
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "rounded-xl px-4 py-2 text-sm font-bold transition-colors " +
                (tab === t.id ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="px-4 py-2 text-xs text-slate-500">{TABS.find((t) => t.id === tab)?.hint}</p>
      </div>

      {/* ================= GENERAL ================= */}
      {tab === "general" && (
        <>
          <Section title="Basics" description="Name and describe your tour.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="name" required className="sm:col-span-2">
                <Input id="name" value={v.name} onChange={set("name")} required minLength={3} maxLength={160} />
              </Field>
              <Field
                label="Short description"
                htmlFor="shortDescription"
                required
                className="sm:col-span-2"
                hint="Shown on cards and used as the SEO description. Keep it under 300 characters."
              >
                <Textarea
                  id="shortDescription"
                  value={v.shortDescription}
                  onChange={set("shortDescription")}
                  className="min-h-20"
                  maxLength={300}
                />
              </Field>
              <Field label="URL slug" htmlFor="slug" hint="Leave empty to generate it from the title.">
                <Input id="slug" value={v.slug} onChange={set("slug")} maxLength={80} placeholder="ubud-atv-adventure" />
              </Field>
              <div className="flex items-end">
                <p className="text-xs text-slate-500">
                  The slug is the last part of the public URL: <span className="font-mono">/trip/&lt;slug&gt;</span>
                </p>
              </div>
              <Field
                label="Full description"
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
                  maxLength={20000}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Destinations & categories"
            description="Add several destinations for multi-day tours and list the regions covered inside each one."
          >
            <div className="space-y-3">
              {v.destinationLinks.length === 0 && (
                <p className="text-sm text-slate-400">No destinations added yet.</p>
              )}
              {v.destinationLinks.map((row, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label={i === 0 ? "Destination" : `Destination ${i + 1}`} htmlFor={`dest-${i}`}>
                    <Select
                      id={`dest-${i}`}
                      value={row.id}
                      onChange={(e) =>
                        setV((prev) => ({
                          ...prev,
                          destinationLinks: prev.destinationLinks.map((d, idx) =>
                            idx === i ? { ...d, id: e.target.value } : d
                          ),
                        }))
                      }
                    >
                      <option value="">— choose —</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Regions" htmlFor={`regions-${i}`} hint="Comma separated, e.g. Ubud, Tegalalang">
                    <Input
                      id={`regions-${i}`}
                      value={row.regions}
                      onChange={(e) =>
                        setV((prev) => ({
                          ...prev,
                          destinationLinks: prev.destinationLinks.map((d, idx) =>
                            idx === i ? { ...d, regions: e.target.value } : d
                          ),
                        }))
                      }
                      placeholder="Ubud, Tegalalang"
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() =>
                        setV((prev) => ({
                          ...prev,
                          destinationLinks: prev.destinationLinks.filter((_, idx) => idx !== i),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setV((prev) => ({
                    ...prev,
                    destinationLinks: [...prev.destinationLinks, { id: "", regions: "" }],
                  }))
                }
              >
                + Add destination
              </Button>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Trip length</h3>
              <p className="mt-1 text-xs text-slate-500">
                Decides whether this tour is listed under <strong>1 Day Trips</strong> or{" "}
                <strong>Multi-day Trips</strong> on the storefront — 24 hours or more counts as
                multi-day.
              </p>
              <div className="mt-3 grid max-w-2xl gap-2 sm:grid-cols-2">
                {([
                  { id: "DAY", icon: "🕗", title: "1 Day Trip", hint: "Back the same day — under 24 hours" },
                  { id: "MULTIDAY", icon: "🧳", title: "Multiday Trip", hint: "Spans a night — 24 hours or more" },
                ] as const).map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                      v.tripLength === opt.id
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tripLength"
                      className="mt-0.5"
                      checked={v.tripLength === opt.id}
                      onChange={() => {
                        setV((prev) => ({
                          ...prev,
                          tripLength: opt.id,
                          // A multi-day trip spans a night: keep at least 24 h so the
                          // days field below never starts below 1 day.
                          ...(opt.id === "MULTIDAY" && Number(prev.durationHours) < 24
                            ? { durationHours: "24" }
                            : {}),
                        }));
                        setTripLengthTouched(true);
                        setSaved(null);
                      }}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {opt.icon} {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Categories</h3>
              <p className="mt-1 text-xs text-slate-500">Select every category this tour belongs to.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {categoryList.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={v.categoryLinks.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
                {categoryList.length === 0 && <p className="text-sm text-slate-400">No categories available yet — add the first one below.</p>}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
                <Field
                  label="Add a category"
                  htmlFor="new-category"
                  hint="Pick a name that isn't listed and press Add — it is selected for you."
                  className="min-w-[240px] flex-1"
                >
                  <Input
                    id="new-category"
                    value={newCategory}
                    onChange={(e) => {
                      setNewCategory(e.target.value);
                      setCategoryError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addCategory();
                      }
                    }}
                    maxLength={60}
                    placeholder="Jet ski"
                  />
                </Field>
                <div className="flex items-center pb-6">
                  <Button type="button" variant="outline" size="sm" onClick={() => void addCategory()} disabled={addingCategory}>
                    {addingCategory ? "Adding…" : "+ Add category"}
                  </Button>
                </div>
              </div>
              {categoryError && <p className="mt-2 text-sm font-semibold text-red-600">{categoryError}</p>}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Activities</h3>
              <p className="mt-1 text-xs text-slate-500">
                Link this tour to an activity — it shows up on that activity&apos;s page on the
                storefront.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {activityList.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={v.categoryLinks.includes(a.id)}
                      onChange={() => toggleCategory(a.id)}
                    />
                    {a.name}
                  </label>
                ))}
                {activityList.length === 0 && (
                  <p className="text-sm text-slate-400">No activities yet — add the first one below.</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
                <Field
                  label="Add an activity"
                  htmlFor="new-activity"
                  hint="Pick a name that isn't listed and press Add — it is selected for you."
                  className="min-w-[240px] flex-1"
                >
                  <Input
                    id="new-activity"
                    value={newActivity}
                    onChange={(e) => {
                      setNewActivity(e.target.value);
                      setActivityError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addActivity();
                      }
                    }}
                    maxLength={60}
                    placeholder="Trekking"
                  />
                </Field>
                <div className="flex items-center pb-6">
                  <Button type="button" variant="outline" size="sm" onClick={() => void addActivity()} disabled={addingActivity}>
                    {addingActivity ? "Adding…" : "+ Add activity"}
                  </Button>
                </div>
              </div>
              {activityError && <p className="mt-2 text-sm font-semibold text-red-600">{activityError}</p>}
            </div>
          </Section>

          <Section title="Details" description="Duration, group size and difficulty.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={v.tripLength === "MULTIDAY" ? "Duration (days)" : "Duration (hours)"}
                htmlFor="durationHours"
                required
                hint={
                  v.tripLength === "MULTIDAY"
                    ? "Whole trip in days (1–31) — 24 hours = 1 day, so a 3-day tour is “3”."
                    : Number(v.durationHours) >= 24
                      ? "24 hours or more counts as a multi-day trip — switch the trip length above."
                      : "Total hours, back the same day."
                }
              >
                <Input
                  id="durationHours"
                  type="number"
                  // Days are free-typed (1.08 days = 26 h) — a fixed step would
                  // flag perfectly valid durations as invalid.
                  step={v.tripLength === "MULTIDAY" ? "any" : "0.5"}
                  min={v.tripLength === "MULTIDAY" ? "1" : "0.5"}
                  max={v.tripLength === "MULTIDAY" ? "31" : "240"}
                  value={
                    v.tripLength === "MULTIDAY"
                      ? v.durationHours === ""
                        ? ""
                        // Never show a fraction below a whole day — a legacy
                        // sub-24 h multiday tour reads as “1”, not “0.17”.
                        : String(Math.max(1, Math.round((Number(v.durationHours) / 24) * 100) / 100))
                      : v.durationHours
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Multi-day tours are entered in days (×24 stored as hours);
                    // day tours keep entering hours.
                    const hours =
                      raw === ""
                        ? ""
                        : v.tripLength === "MULTIDAY"
                          ? String(Math.round(Number(raw) * 24 * 2) / 2)
                          : raw;
                    const numeric = hours === "" ? 0 : Number(hours);
                    const auto: Partial<TourFormValues> =
                      !tripLengthTouched && numeric >= 0.5
                        ? { tripLength: numeric >= 24 ? "MULTIDAY" : "DAY" }
                        : {};
                    setV((prev) => ({ ...prev, durationHours: hours, ...auto }));
                    setSaved(null);
                  }}
                />
              </Field>
              <Field
                label="Duration text"
                htmlFor="durationLabel"
                hint="Human wording shown on cards, e.g. “1 hour activity” or “3 days / 2 nights”."
              >
                <Input id="durationLabel" value={v.durationLabel} onChange={set("durationLabel")} maxLength={60} />
              </Field>
              <Field label="Difficulty" htmlFor="difficulty">
                <Select id="difficulty" value={v.difficulty} onChange={set("difficulty")}>
                  <option value="EASY">Easy</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="CHALLENGING">Challenging</option>
                </Select>
              </Field>
              <Field label="Tour type" htmlFor="tourType">
                <Select id="tourType" value={v.tourType} onChange={set("tourType")}>
                  <option value="GROUP">Group tour</option>
                  <option value="PRIVATE">Private tour</option>
                </Select>
              </Field>
              <Field
                label="Min adults (required)"
                htmlFor="minParticipants"
                hint="Adults only — children (2–6) and infants (under 3) are added on top of this minimum."
                required
              >
                <Input
                  id="minParticipants"
                  type="number"
                  min="1"
                  max="200"
                  value={v.minParticipants}
                  onChange={set("minParticipants")}
                />
              </Field>
              <Field label="Max pax" htmlFor="maxParticipants" hint="Total travellers including children and infants." required>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="1"
                  max="500"
                  value={v.maxParticipants}
                  onChange={set("maxParticipants")}
                />
              </Field>
              <Field label="Location" htmlFor="location">
                <Input id="location" value={v.location} onChange={set("location")} placeholder="Ubud, Bali" />
              </Field>
              <Field label="Meeting point" htmlFor="meetingPoint">
                <Input id="meetingPoint" value={v.meetingPoint} onChange={set("meetingPoint")} />
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

          <Section title="Important note" description="Anything guests must know before they book.">
            <Field
              label="Important note"
              htmlFor="importantInfo"
              hint="Rich text — bold, italic, lists and links. No character limit."
            >
              <RichTextEditor
                id="importantInfo"
                value={v.importantInfo}
                placeholder="Bring a towel, wear shoes you don't mind getting muddy…"
                minHeightClass="min-h-32"
                onChange={(val) => {
                  setV((prev) => ({ ...prev, importantInfo: val }));
                  setSaved(null);
                }}
              />
            </Field>
          </Section>

          <Section
            title="SEO"
            description="Overrides for search engines. Leave empty to reuse the title & short description."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SEO title" htmlFor="seoTitle" className="sm:col-span-2">
                <Input id="seoTitle" value={v.seoTitle} onChange={set("seoTitle")} maxLength={160} />
              </Field>
              <Field label="SEO description" htmlFor="seoDescription" className="sm:col-span-2">
                <Textarea
                  id="seoDescription"
                  value={v.seoDescription}
                  onChange={set("seoDescription")}
                  className="min-h-20"
                  maxLength={300}
                />
              </Field>
              <Field label="SEO keywords" htmlFor="seoKeywords" className="sm:col-span-2">
                <Input id="seoKeywords" value={v.seoKeywords} onChange={set("seoKeywords")} maxLength={300} />
              </Field>
            </div>
          </Section>

          <Section title="Photos" description="Upload from your device or paste a hosted URL. The first photo is the main card image.">
            <div className="space-y-3">
              {v.mediaUrls.map((url, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-1 hidden h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:block">
                    {url.trim() && (
                      // eslint-disable-next-line @next/next/no-img-element -- uploaded URLs may be cross-origin
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                  </span>
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
                    onClick={() => setV((p) => ({ ...p, mediaUrls: p.mediaUrls.filter((_, idx) => idx !== i) }))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {uploadError && <Alert tone="error">{uploadError}</Alert>}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="dark" size="sm" disabled={uploading > 0} onClick={() => fileRef.current?.click()}>
                  {uploading > 0 ? `Uploading ${uploading}…` : "⬆ Upload from device"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setV((p) => ({ ...p, mediaUrls: [...p.mediaUrls, ""] }))}
                >
                  + Add URL
                </Button>
                <span className="text-xs text-slate-500">JPG, PNG, WebP, AVIF or GIF · up to 4MB each.</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                multiple
                className="hidden"
                onChange={(e) => void onPickFiles(e.target.files)}
              />
            </div>
          </Section>
        </>
      )}

      {/* ============ HIGHLIGHTS & ITINERARY ============ */}
      {tab === "content" && (
        <>
          <Section
            title="Highlights"
            description="One highlight per line — each line becomes a bullet. Bold, italic, lists and links are supported and there is no character limit."
          >
            <RichTextEditor
              id="highlights"
              variant="list"
              value={v.highlights}
              placeholder="Hotel pickup included · Small groups of 8 · Free cancellation"
              minHeightClass="min-h-32"
              onChange={(val) => {
                setV((prev) => ({ ...prev, highlights: val }));
                setSaved(null);
              }}
            />
          </Section>

          <Section title="Include & Exclude" description="One item per line.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What's included" htmlFor="inclusions">
                <Textarea id="inclusions" value={v.inclusions} onChange={set("inclusions")} className="min-h-32" />
              </Field>
              <Field label="Not included" htmlFor="exclusions">
                <Textarea id="exclusions" value={v.exclusions} onChange={set("exclusions")} className="min-h-32" />
              </Field>
              <Field label="What to bring" htmlFor="whatToBring" className="sm:col-span-2">
                <Textarea id="whatToBring" value={v.whatToBring} onChange={set("whatToBring")} className="min-h-24" />
              </Field>
            </div>
          </Section>

          <Section title="Itinerary" description="Add each stop with an optional time.">
            <div className="space-y-3">
              {v.itinerary.length === 0 && <p className="text-sm text-slate-400">No itinerary stops yet.</p>}
              {v.itinerary.map((row, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                    <Field label="Time" htmlFor={`it-time-${i}`}>
                      <Input
                        id={`it-time-${i}`}
                        value={row.time}
                        onChange={(e) => setItinerary(i, { time: e.target.value })}
                        placeholder="09:00"
                      />
                    </Field>
                    <Field label="Title" htmlFor={`it-title-${i}`}>
                      <Input
                        id={`it-title-${i}`}
                        value={row.title}
                        onChange={(e) => setItinerary(i, { title: e.target.value })}
                        placeholder="Arrive at the trailhead"
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() =>
                          setV((p) => ({ ...p, itinerary: p.itinerary.filter((_, idx) => idx !== i) }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <Field
                    label="Details"
                    htmlFor={`it-text-${i}`}
                    className="mt-3"
                    hint="Rich text — bold, italic, lists and links. No character limit."
                  >
                    <RichTextEditor
                      id={`it-text-${i}`}
                      value={row.text}
                      placeholder="What happens at this stop…"
                      minHeightClass="min-h-24"
                      onChange={(val) => {
                        setItinerary(i, { text: val });
                        setSaved(null);
                      }}
                    />
                  </Field>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setV((p) => ({ ...p, itinerary: [...p.itinerary, { time: "", title: "", text: "" }] }))
                }
              >
                + Add itinerary stop
              </Button>
            </div>
          </Section>

          <Section title="FAQ" description="Questions guests often ask about this tour.">
            <div className="space-y-3">
              {v.faq.length === 0 && <p className="text-sm text-slate-400">No FAQ entries yet.</p>}
              {v.faq.map((row, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <Field label="Question" htmlFor={`faq-q-${i}`} className="flex-1">
                      <Input id={`faq-q-${i}`} value={row.q} onChange={(e) => setFaq(i, { q: e.target.value })} />
                    </Field>
                    <div className="flex items-end pt-6">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setV((p) => ({ ...p, faq: p.faq.filter((_, idx) => idx !== i) }))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <Field label="Answer" htmlFor={`faq-a-${i}`} className="mt-3">
                    <Textarea
                      id={`faq-a-${i}`}
                      value={row.a}
                      onChange={(e) => setFaq(i, { a: e.target.value })}
                      className="min-h-20"
                    />
                  </Field>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setV((p) => ({ ...p, faq: [...p.faq, { q: "", a: "" }] }))}
              >
                + Add FAQ
              </Button>
            </div>
          </Section>
        </>
      )}

      {/* ============ PRICING & AVAILABILITY ============ */}
      {tab === "pricing" && (
        <>
          <Section
            title="Base price"
            description="The default price per person. Cards show it struck through when a pricing tier goes lower."
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <Field
                label="Currency"
                htmlFor="currency"
                hint={preferredCurrency ? `Preferred: ${preferredCurrency}` : undefined}
              >
                <Select id="currency" value={v.currency} onChange={set("currency")}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Base adult (${currency})`} htmlFor="priceAdult" required>
                <Input id="priceAdult" inputMode="decimal" value={v.priceAdult} onChange={set("priceAdult")} />
              </Field>
              <Field label={`Child (${currency})`} htmlFor="priceChild">
                <Input id="priceChild" inputMode="decimal" value={v.priceChild} onChange={set("priceChild")} />
              </Field>
              <Field label={`Infant (${currency})`} htmlFor="priceInfant">
                <Input id="priceInfant" inputMode="decimal" value={v.priceInfant} onChange={set("priceInfant")} />
              </Field>
            </div>

            <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
              <p className="font-semibold text-brand-900">Card price preview</p>
              <p className="mt-1 text-brand-800">
                {pricePreview.effective < pricePreview.base && pricePreview.base > 0 ? (
                  <>
                    <span className="mr-2 text-slate-400 line-through">
                      {formatMoney(pricePreview.base, pricePreview.currency)}
                    </span>
                    <span className="text-lg font-extrabold text-brand-800">
                      {formatMoney(pricePreview.effective, pricePreview.currency)}
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-extrabold text-brand-800">
                    {formatMoney(pricePreview.effective, pricePreview.currency)}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-500"> / adult · from lowest tier</span>
              </p>
            </div>
          </Section>

          <Section
            title="Pricing options"
            description="Optional departures or ticket types. Each option can hold a description, an agent/member discount and price tiers."
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Options ({v.options.length})
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditing({ index: v.options.length, isNew: true, draft: emptyOption() })
                }
              >
                + Add option
              </Button>
            </div>

            {v.options.length === 0 && <p className="mt-3 text-sm text-slate-400">No pricing options yet.</p>}

            <div className="mt-3 space-y-2">
              {v.options.map((o, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {o.name || <span className="text-slate-400">Untitled option</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {o.startTime ? `Starts ${o.startTime}` : "No start time"}
                      {" · "}{o.tiers.length} tier{o.tiers.length === 1 ? "" : "s"}
                      {o.questions.length > 0 &&
                        ` · ${o.questions.length} additional field${o.questions.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={o.active ? "green" : "neutral"}>
                      {o.active ? "Active" : "Hidden"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          index: i,
                          isNew: false,
                          draft: {
                            ...o,
                            tiers: o.tiers.map((t) => ({ ...t })),
                            questions: o.questions.map((q) => ({ ...q })),
                          },
                        })
                      }
                    >
                      Edit
                    </Button>
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
              ))}
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
        </>
      )}

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

      {editing && (
        <OptionEditorModal
          index={editing.index}
          isNew={editing.isNew}
          draft={editing.draft}
          currency={currency}
          onChange={(patch) =>
            setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))
          }
          onSave={saveOptionDraft}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
