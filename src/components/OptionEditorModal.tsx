"use client";

import { useEffect } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { TourOptionRow, TourQuestionRow, TourTierRow } from "@/components/SupplierTourForm";

const emptyTier = (): TourTierRow => ({ label: "", minPax: "1", maxPax: "", price: "" });

const emptyQuestion = (): TourQuestionRow => ({
  label: "",
  type: "TEXT",
  remark: "",
  choices: "",
  required: false,
});

/**
 * Modal editor for a single pricing option: name, schedule, description,
 * agent discount, price tiers and additional-info booking questions.
 * Edits happen on a draft owned by the parent; Save commits, Cancel discards.
 */
export function OptionEditorModal({
  index,
  isNew,
  draft,
  currency,
  onChange,
  onSave,
  onCancel,
}: {
  index: number;
  isNew: boolean;
  draft: TourOptionRow;
  currency: string;
  onChange: (patch: Partial<TourOptionRow>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  // Escape closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const setTier = (ti: number, patch: Partial<TourTierRow>) =>
    onChange({ tiers: draft.tiers.map((t, i) => (i === ti ? { ...t, ...patch } : t)) });

  const setQuestion = (qi: number, patch: Partial<TourQuestionRow>) =>
    onChange({ questions: draft.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6"
      onMouseDown={(e) => {
        // Only backdrop clicks close — not drags that start inside the dialog.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add pricing option" : "Edit pricing option"}
        className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {isNew ? "Add pricing option" : "Edit pricing option"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {isNew
                ? "A departure or ticket type customers can pick when booking."
                : `Editing “${draft.name || `Option ${index + 1}`}” — changes apply when you save the tour.`}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={onCancel}>
            ✕
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Option name" htmlFor={`opt-name-${index}`} required>
              <Input
                id={`opt-name-${index}`}
                value={draft.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Morning departure"
                autoFocus
              />
            </Field>
            <Field label="Start time" htmlFor={`opt-time-${index}`}>
              <Input
                id={`opt-time-${index}`}
                value={draft.startTime}
                onChange={(e) => onChange({ startTime: e.target.value })}
                placeholder="09:00"
              />
            </Field>
            <Field label="Description" htmlFor={`opt-desc-${index}`} className="sm:col-span-2">
              <Textarea
                id={`opt-desc-${index}`}
                value={draft.description}
                onChange={(e) => onChange({ description: e.target.value })}
                className="min-h-16"
              />
            </Field>
            {/* Adult/Child/Infant price and capacity offset are managed in the
                "Base price" and "Capacity & booking window" sections of the main
                form — kept out of the option so they aren't edited twice. */}
            <Field
              label="Agent / member net price"
              htmlFor={`opt-net-${index}`}
              hint="Discount % off for agents/members. Leave empty if you don't offer one."
            >
              <Input
                id={`opt-net-${index}`}
                inputMode="decimal"
                value={draft.agentNet}
                onChange={(e) => onChange({ agentNet: e.target.value })}
                placeholder="e.g. 10"
              />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => onChange({ active: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Pricing tiers ({draft.tiers.length})
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ tiers: [...draft.tiers, emptyTier()] })}
              >
                + Add tier
              </Button>
            </div>
            {draft.tiers.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                No tiers — this option uses the base prices.
              </p>
            )}
            <div className="mt-2 space-y-2">
              {draft.tiers.map((t, ti) => (
                <div key={ti} className="grid gap-2 sm:grid-cols-[1fr_80px_80px_120px_auto]">
                  <Field label="Label" htmlFor={`tier-label-${index}-${ti}`}>
                    <Input
                      id={`tier-label-${index}-${ti}`}
                      value={t.label}
                      onChange={(e) => setTier(ti, { label: e.target.value })}
                      placeholder="2 travellers"
                    />
                  </Field>
                  <Field label="Min pax" htmlFor={`tier-min-${index}-${ti}`}>
                    <Input
                      id={`tier-min-${index}-${ti}`}
                      type="number"
                      min="1"
                      value={t.minPax}
                      onChange={(e) => setTier(ti, { minPax: e.target.value })}
                    />
                  </Field>
                  <Field label="Max pax" htmlFor={`tier-max-${index}-${ti}`}>
                    <Input
                      id={`tier-max-${index}-${ti}`}
                      type="number"
                      min="1"
                      value={t.maxPax}
                      onChange={(e) => setTier(ti, { maxPax: e.target.value })}
                    />
                  </Field>
                  <Field label={`Price (${currency})`} htmlFor={`tier-price-${index}-${ti}`}>
                    <Input
                      id={`tier-price-${index}-${ti}`}
                      inputMode="decimal"
                      value={t.price}
                      onChange={(e) => setTier(ti, { price: e.target.value })}
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      aria-label={`Remove tier ${ti + 1}`}
                      onClick={() => onChange({ tiers: draft.tiers.filter((_, i) => i !== ti) })}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Additional info (booking questions)
                </h4>
                <p className="mt-0.5 text-xs text-slate-400">
                  Extra questions for customers who pick this option. Answers appear on the voucher.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ questions: [...draft.questions, emptyQuestion()] })}
              >
                + Add field
              </Button>
            </div>
            {draft.questions.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                No extra fields — customers only enter the standard details.
              </p>
            )}
            <div className="mt-2 space-y-3">
              {draft.questions.map((q, qi) => (
                <div key={qi} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Field {qi + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      aria-label={`Remove field ${qi + 1}`}
                      onClick={() => onChange({ questions: draft.questions.filter((_, i) => i !== qi) })}
                    >
                      🗑
                    </Button>
                  </div>
                  <div className="mt-1.5">
                    <Input
                      aria-label={`Field ${qi + 1} label`}
                      value={q.label}
                      onChange={(e) => setQuestion(qi, { label: e.target.value })}
                      placeholder="Departure (pick up) Detail"
                    />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Answer type">
                      <Select
                        aria-label={`Field ${qi + 1} answer type`}
                        value={q.type}
                        onChange={(e) => setQuestion(qi, { type: e.target.value as TourQuestionRow["type"] })}
                      >
                        <option value="READ_ONLY">Read only (notice — shown, not answered)</option>
                        <option value="TEXT">Text (customer types an answer)</option>
                        <option value="SELECT">Select (pick an option)</option>
                      </Select>
                    </Field>
                    <Field
                      label="Remark / help text"
                      hint={
                        q.type === "READ_ONLY"
                          ? "The notice text customers see for this field."
                          : "Placeholder / help text under the input."
                      }
                    >
                      <Input
                        aria-label={`Field ${qi + 1} remark`}
                        value={q.remark}
                        onChange={(e) => setQuestion(qi, { remark: e.target.value })}
                        placeholder={
                          q.type === "READ_ONLY"
                            ? "08:00 AM - 08:30 AM"
                            : "Please describe departure details (Hotel/Airport/Port)"
                        }
                      />
                    </Field>
                  </div>
                  {q.type === "SELECT" && (
                    <Field
                      label="Options (one per line)"
                      hint="Customers pick one of these from a dropdown."
                      className="mt-2"
                    >
                      <Textarea
                        aria-label={`Field ${qi + 1} choices`}
                        value={q.choices}
                        onChange={(e) => setQuestion(qi, { choices: e.target.value })}
                        placeholder={"Standard\nVIP\nWith transport"}
                        className="min-h-20"
                      />
                    </Field>
                  )}
                  {(q.type === "TEXT" || q.type === "SELECT") && (
                    <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => setQuestion(qi, { required: e.target.checked })}
                      />
                      Required field
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            {isNew ? "Add option" : "Save option"}
          </Button>
        </div>
      </div>
    </div>
  );
}
