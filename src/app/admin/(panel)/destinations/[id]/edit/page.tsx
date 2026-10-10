import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { DestinationForm } from "@/components/admin/DestinationForm";

export const metadata: Metadata = { title: "Edit destination" };

export default async function EditDestinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.destination.findUnique({ where: { id } });
  if (!d) notFound();

  return (
    <>
      <Link href="/admin/destinations" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to destinations
      </Link>
      <PageHeader title={d.name} subtitle={`Editing /${d.slug}`} />
      <DestinationForm
        mode="edit"
        destinationId={d.id}
        initial={{
          name: d.name,
          slug: d.slug,
          region: d.region ?? "",
          description: d.description ?? "",
          intro: d.intro ?? "",
          heroImage: d.heroImage ?? "",
          image: d.image ?? "",
          sortOrder: String(d.sortOrder),
          active: d.active,
        }}
      />
    </>
  );
}
