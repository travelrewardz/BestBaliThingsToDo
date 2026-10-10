import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { SettingsForm, type SettingRow, type SeoValues } from "@/components/admin/SettingsForm";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const [rows, seo] = await Promise.all([
    prisma.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] }),
    prisma.seoSetting.findUnique({ where: { key: "site" } }),
  ]);

  // Always show the platform's standard keys; saved rows win over the defaults.
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const settings: SettingRow[] = [];
  for (const d of DEFAULT_SETTINGS) {
    const saved = byKey.get(d.key);
    if (saved) byKey.delete(d.key);
    settings.push({
      key: d.key,
      label: saved?.label || d.label,
      group: saved?.group || d.group,
      type: saved?.type || d.type,
      value: saved?.value ?? d.value,
    });
  }
  for (const extra of byKey.values()) {
    settings.push({ key: extra.key, label: extra.label || extra.key, group: extra.group, type: extra.type, value: extra.value });
  }

  const seoValues: SeoValues = {
    siteTitle: seo?.siteTitle ?? "Bali Things To Do",
    siteDescription: seo?.siteDescription ?? "",
    defaultTitleSuffix: seo?.defaultTitleSuffix ?? "",
    canonicalBase: seo?.canonicalBase ?? "",
    googleVerification: seo?.googleVerification ?? "",
    bingVerification: seo?.bingVerification ?? "",
    analyticsId: seo?.analyticsId ?? "",
    tagManagerId: seo?.tagManagerId ?? "",
    ogImage: seo?.ogImage ?? "",
    twitterHandle: seo?.twitterHandle ?? "",
    noindex: seo?.noindex ?? false,
  };

  return (
    <>
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="Platform defaults, contact details, commission and SEO." />
      {rows.length === 0 && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Showing the platform defaults — saving will store them in the database.
        </p>
      )}
      <SettingsForm settings={settings} seo={seoValues} />
    </>
  );
}
