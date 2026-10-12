import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/DataTable";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata: Metadata = { title: "New category" };

export default function NewCategoryPage() {
  return (
    <>
      <Link href="/admin/destinations" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to destinations
      </Link>
      <PageHeader title="New category" subtitle="Categories group tours across the site — suppliers can also add them from the tour form." />
      <CategoryForm
        mode="create"
        initial={{ name: "", slug: "", kind: "CATEGORY", description: "", image: "", icon: "", sortOrder: "0", active: true }}
      />
    </>
  );
}
