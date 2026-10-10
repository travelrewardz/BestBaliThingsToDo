import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge, Pagination } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { statusLabel } from "@/lib/supplier";
import { fmtDate, pageParam, userStatusTone } from "@/lib/admin";

export const metadata: Metadata = { title: "Customers" };

const PER_PAGE = 20;
const FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "active", label: "Active", statuses: ["ACTIVE"] },
  { key: "suspended", label: "Suspended", statuses: ["SUSPENDED"] },
] as const;

type Row = Awaited<ReturnType<typeof load>>["rows"][number];

async function load(where: Prisma.UserWhereInput, page: number) {
  return {
    total: await prisma.user.count({ where }),
    rows: await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        locale: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { bookings: true, reviews: true } },
      },
    }),
  };
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const q = (sp.q ?? "").trim();

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(filter.statuses ? { status: { in: [...filter.statuses] } } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
  };
  const total = await prisma.user.count({ where });
  const page = pageParam(sp.page, PER_PAGE, total);
  const { rows } = await load(where, page);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Customer",
      render: (u) => (
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">{u.name}</span>
          <span className="block text-xs text-slate-400">{u.email}</span>
        </span>
      ),
    },
    { key: "phone", header: "Phone", render: (u) => <span className="text-slate-600">{u.phone || "—"}</span> },
    {
      key: "activity",
      header: "Activity",
      render: (u) => (
        <span className="text-slate-600">
          <span className="block font-semibold text-slate-900">{u._count.bookings} bookings</span>
          <span className="block text-xs text-slate-400">{u._count.reviews} reviews</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={userStatusTone(u.status)}>{statusLabel(u.status)}</Badge>
          <span className="text-xs text-slate-400">joined {fmtDate(u.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "last",
      header: "Last login",
      render: (u) => <span className="text-slate-500">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Never"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (u) =>
        u.status === "SUSPENDED" ? (
          <ActionButton endpoint={`/api/admin/customers/${u.id}/status`} body={{ status: "ACTIVE" }} label="Reactivate" variant="primary" />
        ) : (
          <ActionButton
            endpoint={`/api/admin/customers/${u.id}/status`}
            body={{ status: "SUSPENDED" }}
            label="Suspend"
            variant="danger"
            confirm={`Suspend ${u.name}?`}
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="People" title="Customers" subtitle={`${total} customer account${total === 1 ? "" : "s"} in the current view.`} />
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/customers?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              f.key === filter.key ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2" action="/admin/customers" method="get">
          <input type="hidden" name="status" value={filter.key} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone…"
            className="w-56 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button type="submit" className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} emptyTitle="No customers found" />
      <Pagination page={page} pages={pages} basePath="/admin/customers" params={{ status: filter.key, q }} />
    </>
  );
}
