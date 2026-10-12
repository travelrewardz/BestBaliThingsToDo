import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { FaqForm } from "@/components/admin/FaqForm";

export const metadata: Metadata = { title: "Edit FAQ" };

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) notFound();

  return (
    <>
      <Link href="/admin/cms" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to CMS
      </Link>
      <PageHeader title="Edit FAQ" subtitle={faq.question} />
      <FaqForm
        mode="edit"
        faqId={faq.id}
        initial={{
          question: faq.question,
          answer: faq.answer,
          scope: faq.scope,
          sortOrder: String(faq.sortOrder),
          active: faq.active,
        }}
      />
    </>
  );
}
