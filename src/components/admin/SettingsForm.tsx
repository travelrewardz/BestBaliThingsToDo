"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export type SettingRow = { key: string; label: string; group: string; type: string; value: string };
export type SeoValues = {
  siteTitle: string;
  siteDescription: string;
  defaultTitleSuffix: string;
  canonicalBase: string;
  googleVerification: string;
  bingVerification: string;
  analyticsId: string;
  tagManagerId: string;
  ogImage: string;
  twitterHandle: string;
  noindex: boolean;
};

/** Edits the Setting table (grouped) plus the site SeoSetting record. */
export function SettingsForm({ settings, seo }: { settings: SettingRow[]; seo: SeoValues }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [seoV, setSeoV] = useState(seo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const groups = [...new Set(settings.map((s) => s.group))];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, seo: seoV }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save settings.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Settings saved.</Alert>}

      {groups.map((group) => (
        <section key={group} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-lg font-bold capitalize text-slate-900">{group}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {settings
              .filter((s) => s.group === group)
              .map((s) => (
                <Field key={s.key} label={s.label} htmlFor={s.key} hint={s.key}>
                  {s.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={values[s.key] === "true" || values[s.key] === "1"}
                        onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.checked ? "true" : "false" }))}
                      />
                      Enabled
                    </label>
                  ) : s.type === "json" ? (
                    <Textarea
                      id={s.key}
                      value={values[s.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                      className="min-h-24 font-mono text-xs"
                    />
                  ) : (
                    <Input
                      id={s.key}
                      type={s.type === "number" ? "number" : "text"}
                      value={values[s.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">SEO &amp; analytics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Site title" htmlFor="siteTitle">
            <Input id="siteTitle" value={seoV.siteTitle} onChange={(e) => setSeoV((s) => ({ ...s, siteTitle: e.target.value }))} />
          </Field>
          <Field label="Title suffix" htmlFor="defaultTitleSuffix">
            <Input id="defaultTitleSuffix" value={seoV.defaultTitleSuffix} onChange={(e) => setSeoV((s) => ({ ...s, defaultTitleSuffix: e.target.value }))} />
          </Field>
          <Field label="Default description" htmlFor="siteDescription" className="sm:col-span-2">
            <Textarea id="siteDescription" value={seoV.siteDescription} onChange={(e) => setSeoV((s) => ({ ...s, siteDescription: e.target.value }))} className="min-h-20" />
          </Field>
          <Field label="Canonical base URL" htmlFor="canonicalBase">
            <Input id="canonicalBase" value={seoV.canonicalBase} onChange={(e) => setSeoV((s) => ({ ...s, canonicalBase: e.target.value }))} />
          </Field>
          <Field label="OG image URL" htmlFor="ogImage">
            <Input id="ogImage" value={seoV.ogImage} onChange={(e) => setSeoV((s) => ({ ...s, ogImage: e.target.value }))} />
          </Field>
          <Field label="Google verification" htmlFor="googleVerification">
            <Input id="googleVerification" value={seoV.googleVerification} onChange={(e) => setSeoV((s) => ({ ...s, googleVerification: e.target.value }))} />
          </Field>
          <Field label="Bing verification" htmlFor="bingVerification">
            <Input id="bingVerification" value={seoV.bingVerification} onChange={(e) => setSeoV((s) => ({ ...s, bingVerification: e.target.value }))} />
          </Field>
          <Field label="Google Analytics ID" htmlFor="analyticsId">
            <Input id="analyticsId" value={seoV.analyticsId} onChange={(e) => setSeoV((s) => ({ ...s, analyticsId: e.target.value }))} placeholder="G-XXXXXXX" />
          </Field>
          <Field label="Tag Manager ID" htmlFor="tagManagerId">
            <Input id="tagManagerId" value={seoV.tagManagerId} onChange={(e) => setSeoV((s) => ({ ...s, tagManagerId: e.target.value }))} placeholder="GTM-XXXXXX" />
          </Field>
          <Field label="Twitter handle" htmlFor="twitterHandle">
            <Input id="twitterHandle" value={seoV.twitterHandle} onChange={(e) => setSeoV((s) => ({ ...s, twitterHandle: e.target.value }))} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={seoV.noindex} onChange={(e) => setSeoV((s) => ({ ...s, noindex: e.target.checked }))} />
            Noindex the whole site
          </label>
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {saved && <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>}
      </div>
    </form>
  );
}
