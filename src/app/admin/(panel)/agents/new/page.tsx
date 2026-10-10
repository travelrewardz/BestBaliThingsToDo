import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/DataTable";
import { AgentForm } from "@/components/admin/AgentForm";

export const metadata: Metadata = { title: "New agent" };

export default function NewAgentPage() {
  return (
    <>
      <Link href="/admin/agents" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to agents
      </Link>
      <PageHeader title="New agent" subtitle="Add a B2B partner who books on behalf of clients." />
      <AgentForm
        mode="create"
        initial={{ name: "", company: "", email: "", phone: "", country: "", commissionPercent: "10", status: "ACTIVE", notes: "" }}
      />
    </>
  );
}
