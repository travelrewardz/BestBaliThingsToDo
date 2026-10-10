import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { SettingsForm, type SeoValues } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const [settings, seo] = await Promise.all([
    prisma.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] }),
    prisma.seoSetting.findUnique({ where: { key: "site" } }),
  ]);

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
      {settings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No settings rows yet — run <code className="font-mono">npm run db:seed</code> to load the defaults.
        </p>
      ) : (
        <SettingsForm
          settings={settings.map((s) => ({ key: s.key, label: s.label || s.key, group: s.group, type: s.type, value: s.value }))}
          seo={seoValues}
        />
      )}
    </>
  );
}
