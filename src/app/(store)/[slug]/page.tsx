import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { mdToHtml } from "@/lib/md";

export const dynamic = "force-dynamic";

/** CMS pages created in Admin → CMS → Pages, served at /{slug}. Drafts stay private. */
async function loadPage(slug: string) {
  return prisma.page.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, slug: true, content: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug).catch(() => null);
  if (!page) return { title: "Page not found" };
  return buildMetadata({
    title: page.title,
    description: `Bali Things To Do — ${page.title}.`,
    path: `/${page.slug}`,
  });
}

export default async function CmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await loadPage(slug).catch(() => null);
  if (!page) notFound();

  // The editor accepts HTML or Markdown — render whichever it contains.
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(page.content);
  const html = isHtml ? page.content : mdToHtml(page.content);

  return (
    <>
      <section className="bg-brand-900">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <nav className="text-xs font-semibold text-brand-200" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-brand-400">/</span>
            <span className="text-white">{page.title}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            {page.title}
          </h1>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-12">
        <div className="prose-bali text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </>
  );
}
