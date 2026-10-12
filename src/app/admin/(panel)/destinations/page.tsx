import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";

export const metadata: Metadata = { title: "Destinations" };

type DestRow = Awaited<ReturnType<typeof load>>["destinations"][number];
type CatRow = Awaited<ReturnType<typeof load>>["categories"][number];

async function load() {
  const [destinations, categories] = await Promise.all([
    prisma.destination.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        description: true,
        intro: true,
        heroImage: true,
        image: true,
        sortOrder: true,
        active: true,
        _count: { select: { products: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        description: true,
        image: true,
        icon: true,
        sortOrder: true,
        active: true,
        _count: { select: { products: true } },
      },
    }),
  ]);
  return { destinations, categories };
}

/** Payload for the activate/deactivate toggle (the PATCH expects the full object). */
const toggleBody = (d: DestRow, active: boolean) => ({
  name: d.name,
  slug: d.slug,
  region: d.region ?? undefined,
  description: d.description ?? undefined,
  intro: d.intro ?? undefined,
  heroImage: d.heroImage ?? undefined,
  image: d.image ?? undefined,
  sortOrder: d.sortOrder,
  active,
});

/** Payload for the category activate/deactivate toggle. */
const catToggleBody = (c: CatRow, active: boolean) => ({
  name: c.name,
  kind: c.kind === "ACTIVITY" ? "ACTIVITY" : "CATEGORY",
  description: c.description ?? undefined,
  image: c.image ?? undefined,
  icon: c.icon ?? undefined,
  sortOrder: c.sortOrder,
  active,
});

export default async function AdminDestinationsPage() {
  const { destinations, categories } = await load();

  const columns: Column<DestRow>[] = [
    {
      key: "name",
      header: "Destination",
      render: (d) => (
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">{d.name}</span>
          <span className="block font-mono text-xs text-slate-400">/{d.slug}</span>
        </span>
      ),
    },
    { key: "region", header: "Region", render: (d) => <span className="text-slate-600">{d.region || "—"}</span> },
    { key: "tours", header: "Tours", render: (d) => <span className="font-semibold text-slate-800">{d._count.products}</span> },
    { key: "order", header: "Order", render: (d) => <span className="text-slate-600">{d.sortOrder}</span> },
    {
      key: "status",
      header: "Status",
      render: (d) => <Badge tone={d.active ? "green" : "neutral"}>{d.active ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap",
      render: (d) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ButtonLink href={`/admin/destinations/${d.id}/edit`} variant="outline" size="sm">
            Edit
          </ButtonLink>
          <ActionButton
            endpoint={`/api/admin/destinations/${d.id}`}
            method="PATCH"
            body={toggleBody(d, !d.active)}
            label={d.active ? "Deactivate" : "Activate"}
          />
          {d._count.products === 0 && (
            <ActionButton
              endpoint={`/api/admin/destinations/${d.id}`}
              method="DELETE"
              label="Delete"
              variant="danger"
              confirm={`Delete destination “${d.name}”?`}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Destinations"
        subtitle={`${destinations.length} destination${destinations.length === 1 ? "" : "s"} · ${categories.length} categories`}
        actions={
          <ButtonLink href="/admin/destinations/new" variant="dark">
            + New destination
          </ButtonLink>
        }
      />

      <DataTable columns={columns} rows={destinations} rowKey={(d) => d.id} emptyTitle="No destinations yet" emptyMessage="Create your first destination." />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Categories</h2>
            <p className="text-xs text-slate-500">
              Suppliers can add a category straight from the tour form — it lands here for you to review.
            </p>
          </div>
          <ButtonLink href="/admin/destinations/categories/new" variant="outline" size="sm">
            + New category
          </ButtonLink>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Kind</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Tours</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.length === 0 && (
                <tr><td className="px-4 py-4 text-slate-400" colSpan={5}>No categories yet.</td></tr>
              )}
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-slate-900">
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </span>
                    <span className="block font-mono text-xs text-slate-400">/{c.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.kind}</td>
                  <td className="px-4 py-3 text-slate-800">{c._count.products}</td>
                  <td className="px-4 py-3"><Badge tone={c.active ? "green" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ButtonLink href={`/admin/destinations/categories/${c.id}/edit`} variant="outline" size="sm">
                        Edit
                      </ButtonLink>
                      <ActionButton
                        endpoint={`/api/admin/categories/${c.id}`}
                        method="PATCH"
                        body={catToggleBody(c, !c.active)}
                        label={c.active ? "Deactivate" : "Activate"}
                      />
                      {c._count.products === 0 && (
                        <ActionButton
                          endpoint={`/api/admin/categories/${c.id}`}
                          method="DELETE"
                          label="Delete"
                          variant="danger"
                          confirm={`Delete category “${c.name}”?`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
