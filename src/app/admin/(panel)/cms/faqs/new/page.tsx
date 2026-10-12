import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/DataTable";
import { FaqForm } from "@/components/admin/FaqForm";

export const metadata: Metadata = { title: "New FAQ" };

export default function NewFaqPage() {
  return (
    <>
      <Link href="/admin/cms" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to CMS
      </Link>
      <PageHeader title="New FAQ" subtitle="A question &amp; answer shown on the site." />
      <FaqForm mode="create" initial={{ question: "", answer: "", scope: "SITE", sortOrder: "0", active: true }} />
    </>
  );
}
