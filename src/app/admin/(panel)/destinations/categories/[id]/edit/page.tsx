import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <>
      <Link href="/admin/destinations" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to destinations
      </Link>
      <PageHeader title={category.name} subtitle={`Editing /${category.slug}`} />
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        initial={{
          name: category.name,
          slug: category.slug,
          kind: category.kind === "ACTIVITY" ? "ACTIVITY" : "CATEGORY",
          description: category.description ?? "",
          image: category.image ?? "",
          icon: category.icon ?? "",
          sortOrder: String(category.sortOrder),
          active: category.active,
        }}
      />
    </>
  );
}
