import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/DataTable";
import { DestinationForm } from "@/components/admin/DestinationForm";

export const metadata: Metadata = { title: "New destination" };

export default function NewDestinationPage() {
  return (
    <>
      <Link href="/admin/destinations" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to destinations
      </Link>
      <PageHeader title="New destination" subtitle="Add a place travelers can browse." />
      <DestinationForm
        mode="create"
        initial={{ name: "", slug: "", region: "", description: "", intro: "", heroImage: "", image: "", sortOrder: "0", active: true }}
      />
    </>
  );
}
