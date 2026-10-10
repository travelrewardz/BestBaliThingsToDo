import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/DataTable";
import { AgentForm } from "@/components/admin/AgentForm";

export const metadata: Metadata = { title: "Edit agent" };

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.agent.findUnique({ where: { id } });
  if (!a) notFound();

  return (
    <>
      <Link href="/admin/agents" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to agents
      </Link>
      <PageHeader title={a.name} subtitle={a.company ?? a.email} />
      <AgentForm
        mode="edit"
        agentId={a.id}
        initial={{
          name: a.name,
          company: a.company ?? "",
          email: a.email,
          phone: a.phone ?? "",
          country: a.country ?? "",
          commissionPercent: String(a.commissionBps / 100),
          status: a.status,
          notes: a.notes ?? "",
        }}
      />
    </>
  );
}
