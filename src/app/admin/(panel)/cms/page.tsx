import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge, StatCard } from "@/components/ui";
import { DataTable, PageHeader, type Column } from "@/components/admin/DataTable";
import { fmtDate } from "@/lib/admin";
import { statusLabel } from "@/lib/supplier";

export const metadata: Metadata = { title: "CMS" };

const CONTENT_TONE = (status: string) => (status === "PUBLISHED" ? "green" : "amber");

export default async function AdminCmsPage() {
  const [pages, posts, faqs, banners, menus, landing, seoCount, mediaCount] = await Promise.all([
    prisma.page.findMany({ orderBy: [{ updatedAt: "desc" }], select: { id: true, title: true, slug: true, status: true, updatedAt: true } }),
    prisma.blogPost.findMany({ orderBy: [{ updatedAt: "desc" }], select: { id: true, title: true, slug: true, status: true, publishedAt: true, viewCount: true } }),
    prisma.faq.findMany({ orderBy: [{ sortOrder: "asc" }], take: 30, select: { id: true, question: true, scope: true, active: true } }),
    prisma.banner.findMany({ orderBy: [{ position: "asc" }, { sortOrder: "asc" }], select: { id: true, title: true, position: true, active: true, link: true } }),
    prisma.menu.findMany({ orderBy: [{ location: "asc" }, { sortOrder: "asc" }], select: { id: true, title: true, url: true, location: true, active: true } }),
    prisma.landingPage.findMany({ orderBy: [{ sortOrder: "asc" }], select: { id: true, title: true, slug: true, kind: true, status: true } }),
    prisma.seoMeta.count(),
    prisma.media.count(),
  ]);

  type PageRow = (typeof pages)[number];
  type PostRow = (typeof posts)[number];
  type FaqRow = (typeof faqs)[number];
  type BannerRow = (typeof banners)[number];
  type MenuRow = (typeof menus)[number];
  type LandingRow = (typeof landing)[number];

  const pageCols: Column<PageRow>[] = [
    { key: "title", header: "Page", render: (p) => (
      <span><span className="block font-semibold text-slate-900">{p.title}</span><span className="block font-mono text-xs text-slate-400">/{p.slug}</span></span>
    ) },
    { key: "status", header: "Status", render: (p) => <Badge tone={CONTENT_TONE(p.status)}>{statusLabel(p.status)}</Badge> },
    { key: "updated", header: "Updated", render: (p) => <span className="text-slate-500">{fmtDate(p.updatedAt)}</span> },
  ];

  const postCols: Column<PostRow>[] = [
    { key: "title", header: "Article", render: (p) => (
      <span><span className="block font-semibold text-slate-900">{p.title}</span><span className="block font-mono text-xs text-slate-400">/{p.slug}</span></span>
    ) },
    { key: "status", header: "Status", render: (p) => <Badge tone={CONTENT_TONE(p.status)}>{statusLabel(p.status)}</Badge> },
    { key: "published", header: "Published", render: (p) => <span className="text-slate-500">{p.publishedAt ? fmtDate(p.publishedAt) : "—"}</span> },
    { key: "views", header: "Views", render: (p) => <span className="text-slate-600">{p.viewCount}</span> },
  ];

  const faqCols: Column<FaqRow>[] = [
    { key: "q", header: "Question", render: (f) => <span className="line-clamp-1 text-slate-700">{f.question}</span> },
    { key: "scope", header: "Scope", render: (f) => <Badge tone="neutral">{f.scope}</Badge> },
    { key: "active", header: "Active", render: (f) => <Badge tone={f.active ? "green" : "neutral"}>{f.active ? "Yes" : "No"}</Badge> },
  ];

  const bannerCols: Column<BannerRow>[] = [
    { key: "title", header: "Banner", render: (b) => <span className="font-semibold text-slate-900">{b.title}</span> },
    { key: "position", header: "Position", render: (b) => <Badge tone="neutral">{b.position}</Badge> },
    { key: "link", header: "Link", render: (b) => <span className="text-slate-500">{b.link || "—"}</span> },
    { key: "active", header: "Active", render: (b) => <Badge tone={b.active ? "green" : "neutral"}>{b.active ? "Yes" : "No"}</Badge> },
  ];

  const menuCols: Column<MenuRow>[] = [
    { key: "title", header: "Menu item", render: (m) => <span className="font-semibold text-slate-900">{m.title}</span> },
    { key: "url", header: "URL", render: (m) => <span className="font-mono text-xs text-slate-500">{m.url}</span> },
    { key: "location", header: "Location", render: (m) => <Badge tone="neutral">{m.location}</Badge> },
    { key: "active", header: "Active", render: (m) => <Badge tone={m.active ? "green" : "neutral"}>{m.active ? "Yes" : "No"}</Badge> },
  ];

  const landingCols: Column<LandingRow>[] = [
    { key: "title", header: "Landing page", render: (l) => (
      <span><span className="block font-semibold text-slate-900">{l.title}</span><span className="block font-mono text-xs text-slate-400">/{l.slug}</span></span>
    ) },
    { key: "kind", header: "Kind", render: (l) => <Badge tone="neutral">{l.kind}</Badge> },
    { key: "status", header: "Status", render: (l) => <Badge tone={CONTENT_TONE(l.status)}>{statusLabel(l.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader eyebrow="Content" title="CMS" subtitle="Pages, guides, FAQs, menus and landing pages." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pages" value={pages.length} icon="📄" />
        <StatCard label="Blog posts" value={posts.length} icon="📝" tone="blue" />
        <StatCard label="Landing pages" value={landing.length} icon="🧩" tone="green" />
        <StatCard label="SEO records" value={seoCount} hint={`${mediaCount} media files`} icon="🔎" tone="orange" />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Pages</h2>
        <DataTable columns={pageCols} rows={pages} rowKey={(p) => p.id} emptyTitle="No pages yet" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Blog posts</h2>
        <DataTable columns={postCols} rows={posts} rowKey={(p) => p.id} emptyTitle="No blog posts yet" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Landing pages</h2>
        <DataTable columns={landingCols} rows={landing} rowKey={(l) => l.id} emptyTitle="No landing pages yet" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Banners</h2>
        <DataTable columns={bannerCols} rows={banners} rowKey={(b) => b.id} emptyTitle="No banners yet" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Menus</h2>
        <DataTable columns={menuCols} rows={menus} rowKey={(m) => m.id} emptyTitle="No menu items yet" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">FAQs</h2>
        <DataTable columns={faqCols} rows={faqs} rowKey={(f) => f.id} emptyTitle="No FAQs yet" />
      </section>
    </>
  );
}
