import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { agentStatusTone } from "@/lib/admin";
import { statusLabel } from "@/lib/supplier";
import { fmtDate } from "@/lib/admin";

export const metadata: Metadata = { title: "Agents" };

type Row = Awaited<ReturnType<typeof load>>[number];

async function load() {
  return prisma.agent.findMany({ orderBy: [{ createdAt: "desc" }] });
}

export default async function AdminAgentsPage() {
  const rows = await load();

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Agent",
      render: (a) => (
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">{a.name}</span>
          <span className="block text-xs text-slate-400">{a.company || "—"}</span>
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (a) => (
        <span className="min-w-0">
          <span className="block text-slate-700">{a.email}</span>
          <span className="block text-xs text-slate-400">{[a.phone, a.country].filter(Boolean).join(" · ") || "—"}</span>
        </span>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      render: (a) => <span className="font-semibold text-slate-900">{(a.commissionBps / 100).toFixed(1)}%</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={agentStatusTone(a.status)}>{statusLabel(a.status)}</Badge>
          <span className="text-xs text-slate-400">added {fmtDate(a.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (a) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ButtonLink href={`/admin/agents/${a.id}/edit`} variant="outline" size="sm">
            Edit
          </ButtonLink>
          <ActionButton
            endpoint={`/api/admin/agents/${a.id}`}
            method="DELETE"
            label="Delete"
            variant="danger"
            confirm={`Delete agent “${a.name}”?`}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Agents"
        subtitle={`${rows.length} B2B agent${rows.length === 1 ? "" : "s"} / resellers.`}
        actions={
          <ButtonLink href="/admin/agents/new" variant="dark">
            + New agent
          </ButtonLink>
        }
      />
      <DataTable columns={columns} rows={rows} rowKey={(a) => a.id} emptyTitle="No agents yet" emptyMessage="Add your first B2B agent or reseller." />
    </>
  );
}
