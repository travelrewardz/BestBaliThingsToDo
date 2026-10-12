import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/DataTable";
import { PageForm } from "@/components/admin/PageForm";

export const metadata: Metadata = { title: "New page" };

export default function NewCmsPage() {
  return (
    <>
      <Link href="/admin/cms" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to CMS
      </Link>
      <PageHeader title="New page" subtitle="A standalone page served at /{slug}." />
      <PageForm mode="create" initial={{ title: "", slug: "", content: "", status: "DRAFT" }} />
    </>
  );
}
