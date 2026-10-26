import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge, Pagination, SmartImage } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { productStatusTone, statusLabel } from "@/lib/supplier";
import { effectiveFromPriceCents, formatDuration } from "@/lib/tours";
import { formatMoney } from "@/lib/money";
import { fmtDate, pageParam } from "@/lib/admin";

export const metadata: Metadata = { title: "Tours" };

const PER_PAGE = 20;

const FILTERS = [
  { key: "review", label: "Awaiting review", statuses: ["SUBMITTED", "IN_REVIEW"] },
  { key: "published", label: "Published", statuses: ["PUBLISHED"] },
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "rejected", label: "Rejected / changes", statuses: ["REJECTED", "CHANGES_REQUESTED", "UNPUBLISHED"] },
  { key: "all", label: "All", statuses: null },
] as const;

type Row = Awaited<ReturnType<typeof loadTours>>["rows"][number];

async function loadTours(where: Prisma.ProductWhereInput, page: number) {
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        currency: true,
        priceAdultCents: true,
        durationHours: true,
        durationLabel: true,
        updatedAt: true,
        supplier: { select: { companyName: true } },
        destination: { select: { name: true } },
        category: { select: { name: true } },
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
        options: { select: { priceAdultCents: true, tiers: { select: { priceCents: true } } } },
      },
    }),
  ]);
  return { total, rows };
}

export default async function AdminToursPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];

  const where: Prisma.ProductWhereInput = filter.statuses ? { status: { in: [...filter.statuses] } } : {};
  const countTotal = await prisma.product.count({ where });
  const page = pageParam(sp.page, PER_PAGE, countTotal);
  const { total, rows } = await loadTours(where, page);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const columns: Column<Row>[] = [
    {
      key: "tour",
      header: "Tour",
      render: (t) => (
        <div className="flex items-center gap-3">
          <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg">
            <SmartImage src={t.media[0]?.url} alt={t.name} fill sizes="56px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <Link href={`/supplier/tours/${t.id}/edit`} className="line-clamp-1 font-semibold text-slate-900 hover:text-brand-700">
              {t.name}
            </Link>
            <span className="block font-mono text-xs text-slate-400">/{t.slug}</span>
          </span>
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", render: (t) => <span className="text-slate-600">{t.supplier.companyName}</span> },
    {
      key: "place",
      header: "Destination / category",
      render: (t) => (
        <span className="text-slate-600">
          {[t.destination?.name, t.category?.name].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      render: (t) => <span className="text-slate-600">{formatDuration(t)}</span>,
    },
    {
      key: "price",
      header: "From",
      render: (t) => {
        const eff = effectiveFromPriceCents(t.priceAdultCents, t.options);
        return <span className="font-semibold text-slate-900">{eff > 0 ? formatMoney(eff, t.currency) : "—"}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={productStatusTone(t.status)}>{statusLabel(t.status)}</Badge>
          <span className="text-xs text-slate-400">{fmtDate(t.updatedAt)}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (t) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {t.status !== "PUBLISHED" && (
            <ActionButton endpoint={`/api/admin/tours/${t.id}/status`} body={{ status: "PUBLISHED" }} label="Publish" variant="primary" />
          )}
          {t.status === "PUBLISHED" && (
            <ActionButton endpoint={`/api/admin/tours/${t.id}/status`} body={{ status: "UNPUBLISHED" }} label="Unpublish" />
          )}
          <ActionButton
            endpoint={`/api/admin/tours/${t.id}/status`}
            body={{ status: "CHANGES_REQUESTED" }}
            prompt="Note to the supplier (requested changes):"
            label="Request changes"
          />
          <ActionButton
            endpoint={`/api/admin/tours/${t.id}/status`}
            body={{ status: "REJECTED" }}
            prompt="Reason for rejection:"
            label="Reject"
            variant="danger"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Tours" subtitle={`${countTotal} tour${countTotal === 1 ? "" : "s"} in the current view.`} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={`/admin/tours?status=${f.key}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                active ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(t) => t.id} emptyTitle="No tours in this view" emptyMessage="Try another status filter." />
      <Pagination page={page} pages={pages} basePath="/admin/tours" params={{ status: filter.key }} />
    </>
  );
}
