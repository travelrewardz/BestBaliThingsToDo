import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge, Pagination, Stars } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { reviewStatusTone } from "@/lib/admin";
import { statusLabel } from "@/lib/supplier";
import { fmtDate, pageParam } from "@/lib/admin";

export const metadata: Metadata = { title: "Reviews" };

const PER_PAGE = 20;
const FILTERS = [
  { key: "pending", label: "Pending", statuses: ["PENDING"] },
  { key: "approved", label: "Approved", statuses: ["APPROVED"] },
  { key: "flagged", label: "Flagged / hidden", statuses: ["FLAGGED", "HIDDEN"] },
  { key: "all", label: "All", statuses: null },
] as const;

type Row = Awaited<ReturnType<typeof load>>["rows"][number];

async function load(where: Prisma.ReviewWhereInput, page: number) {
  return {
    total: await prisma.review.count({ where }),
    rows: await prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
        customer: { select: { name: true } },
      },
    }),
  };
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const where: Prisma.ReviewWhereInput = filter.statuses ? { status: { in: [...filter.statuses] } } : {};
  const total = await prisma.review.count({ where });
  const page = pageParam(sp.page, PER_PAGE, total);
  const { rows } = await load(where, page);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const columns: Column<Row>[] = [
    {
      key: "review",
      header: "Review",
      render: (r) => (
        <span className="block max-w-md">
          <Stars rating={r.rating} />
          {r.title && <span className="mt-1 block font-semibold text-slate-900">{r.title}</span>}
          <span className="mt-0.5 line-clamp-2 block text-slate-600">{r.body}</span>
          <span className="mt-0.5 block text-xs text-slate-400">
            by {r.customer.name} · {fmtDate(r.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: "product",
      header: "Tour",
      render: (r) => <span className="text-slate-600">{r.product.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={reviewStatusTone(r.status)}>{statusLabel(r.status)}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {r.status !== "APPROVED" && (
            <ActionButton endpoint={`/api/admin/reviews/${r.id}/status`} body={{ status: "APPROVED" }} label="Approve" variant="primary" />
          )}
          {r.status !== "HIDDEN" && (
            <ActionButton endpoint={`/api/admin/reviews/${r.id}/status`} body={{ status: "HIDDEN" }} label="Hide" />
          )}
          {r.status !== "FLAGGED" && (
            <ActionButton endpoint={`/api/admin/reviews/${r.id}/status`} body={{ status: "FLAGGED" }} label="Flag" variant="danger" />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Trust" title="Reviews" subtitle={`${total} review${total === 1 ? "" : "s"} in the current view.`} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/reviews?status=${f.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              f.key === filter.key ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="No reviews in this view" />
      <Pagination page={page} pages={pages} basePath="/admin/reviews" params={{ status: filter.key }} />
    </>
  );
}
