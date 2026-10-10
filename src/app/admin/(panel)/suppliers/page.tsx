import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge, Pagination } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { supplierStatusTone, statusLabel } from "@/lib/supplier";
import { formatMoney } from "@/lib/money";
import { fmtDate, pageParam } from "@/lib/admin";

export const metadata: Metadata = { title: "Suppliers" };

const PER_PAGE = 20;
const FILTERS = [
  { key: "pending", label: "Pending", statuses: ["PENDING"] },
  { key: "active", label: "Active", statuses: ["APPROVED", "ACTIVE"] },
  { key: "suspended", label: "Suspended / rejected", statuses: ["SUSPENDED", "REJECTED", "INACTIVE"] },
  { key: "all", label: "All", statuses: null },
] as const;

type Row = Awaited<ReturnType<typeof load>>["rows"][number];

async function load(where: Prisma.SupplierWhereInput, page: number) {
  return {
    total: await prisma.supplier.count({ where }),
    rows: await prisma.supplier.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        companyName: true,
        slug: true,
        email: true,
        phone: true,
        city: true,
        status: true,
        currency: true,
        commissionRateBps: true,
        totalBookings: true,
        totalRevenueCents: true,
        createdAt: true,
        _count: { select: { products: true } },
      },
    }),
  };
}

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const where: Prisma.SupplierWhereInput = filter.statuses ? { status: { in: [...filter.statuses] } } : {};
  const total = await prisma.supplier.count({ where });
  const page = pageParam(sp.page, PER_PAGE, total);
  const { rows } = await load(where, page);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const columns: Column<Row>[] = [
    {
      key: "company",
      header: "Supplier",
      render: (s) => (
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">{s.companyName}</span>
          <span className="block font-mono text-xs text-slate-400">/{s.slug}</span>
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => (
        <span className="text-slate-600">
          <span className="block">{s.email}</span>
          <span className="block text-xs text-slate-400">{[s.phone, s.city].filter(Boolean).join(" · ") || "—"}</span>
        </span>
      ),
    },
    { key: "tours", header: "Tours", render: (s) => <span className="font-semibold text-slate-800">{s._count.products}</span> },
    {
      key: "revenue",
      header: "Bookings / revenue",
      render: (s) => (
        <span className="text-slate-600">
          <span className="block font-semibold text-slate-900">{formatMoney(s.totalRevenueCents, s.currency)}</span>
          <span className="block text-xs text-slate-400">{s.totalBookings} bookings</span>
        </span>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      render: (s) => (
        <span className="text-slate-600">
          {s.commissionRateBps != null ? `${(s.commissionRateBps / 100).toFixed(1)}%` : "Default"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={supplierStatusTone(s.status)}>{statusLabel(s.status)}</Badge>
          <span className="text-xs text-slate-400">since {fmtDate(s.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (s) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {s.status !== "APPROVED" && s.status !== "ACTIVE" && (
            <ActionButton endpoint={`/api/admin/suppliers/${s.id}/status`} body={{ status: "APPROVED" }} label="Approve" variant="primary" />
          )}
          {(s.status === "APPROVED" || s.status === "ACTIVE") && (
            <ActionButton
              endpoint={`/api/admin/suppliers/${s.id}/status`}
              body={{ status: "SUSPENDED" }}
              prompt="Reason for suspension:"
              promptKey="reason"
              label="Suspend"
              variant="danger"
              confirm={`Suspend ${s.companyName}?`}
            />
          )}
          {s.status !== "REJECTED" && (
            <ActionButton
              endpoint={`/api/admin/suppliers/${s.id}/status`}
              body={{ status: "REJECTED" }}
              prompt="Reason for rejection:"
              promptKey="reason"
              label="Reject"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Partners" title="Suppliers" subtitle={`${total} supplier${total === 1 ? "" : "s"} in the current view.`} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/suppliers?status=${f.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              f.key === filter.key ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} emptyTitle="No suppliers in this view" />
      <Pagination page={page} pages={pages} basePath="/admin/suppliers" params={{ status: filter.key }} />
    </>
  );
}
