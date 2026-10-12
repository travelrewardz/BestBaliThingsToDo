import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, Pagination } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { fmtDate, pageParam } from "@/lib/admin";

export const metadata: Metadata = { title: "Media library" };

const PER_PAGE = 24;

type Row = Awaited<ReturnType<typeof load>>["rows"][number];

async function load(where: Prisma.MediaWhereInput, page: number) {
  return {
    total: await prisma.media.count({ where }),
    rows: await prisma.media.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        url: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: { select: { name: true, email: true } },
      },
    }),
  };
}

const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function AdminMediaPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const total = await prisma.media.count();
  const page = pageParam(sp.page, PER_PAGE, total);
  const { rows } = await load({}, page);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const columns: Column<Row>[] = [
    {
      key: "thumb",
      header: "File",
      render: (m) => (
        <span className="flex items-center gap-3">
          <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- media may be cross-origin (Blob) */}
            <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900">{m.fileName}</span>
            <span className="block font-mono text-xs text-slate-400">{m.url}</span>
          </span>
        </span>
      ),
    },
    { key: "type", header: "Type", render: (m) => <Badge tone="neutral">{m.mimeType.replace("image/", "").toUpperCase()}</Badge> },
    { key: "size", header: "Size", render: (m) => <span className="text-slate-600">{formatBytes(m.sizeBytes)}</span> },
    {
      key: "by",
      header: "Uploaded by",
      render: (m) => (
        <span className="text-slate-600">
          <span className="block">{m.uploadedBy?.name ?? "—"}</span>
          <span className="block text-xs text-slate-400">{m.uploadedBy?.email ?? ""}</span>
        </span>
      ),
    },
    { key: "created", header: "Uploaded", render: (m) => <span className="text-slate-500">{fmtDate(m.createdAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (m) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ButtonLink href={m.url} target="_blank" variant="outline" size="sm">
            Open
          </ButtonLink>
          <ActionButton
            endpoint={`/api/admin/media/${m.id}`}
            method="DELETE"
            label="Delete"
            variant="danger"
            confirm={`Delete "${m.fileName}"? Tours using it will show a broken image.`}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Link href="/admin/cms" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to CMS
      </Link>
      <PageHeader
        eyebrow="Content"
        title="Media library"
        subtitle={`${total} file${total === 1 ? "" : "s"} uploaded by admins and suppliers.`}
        actions={<MediaUploader />}
      />
      <DataTable columns={columns} rows={rows} rowKey={(m) => m.id} emptyTitle="No media yet" emptyMessage="Upload your first image above." />
      <Pagination page={page} pages={pages} basePath="/admin/cms/media" params={{}} />
    </>
  );
}
