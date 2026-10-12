import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { PageForm } from "@/components/admin/PageForm";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditCmsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <>
      <Link href="/admin/cms" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to CMS
      </Link>
      <PageHeader title={page.title} subtitle={`Editing /${page.slug}`} />
      <PageForm
        mode="edit"
        pageId={page.id}
        initial={{ title: page.title, slug: page.slug, content: page.content, status: page.status }}
      />
    </>
  );
}
