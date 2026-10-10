import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { HeaderInteractions } from "@/components/HeaderInteractions";
import { NotificationBell } from "@/components/NotificationBell";

async function navItems() {
  const menus = await prisma.menu.findMany({
    where: { location: "HEADER", active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (menus.length) return menus.map((m) => ({ title: m.title, url: m.url }));
  return [
    { title: "Tours", url: "/search" },
    { title: "Activities", url: "/activity/atv" },
    { title: "Destinations", url: "/destination/ubud" },
    { title: "Blog", url: "/blog" },
  ];
}

export async function Header() {
  const [user, items, phone, whatsapp] = await Promise.all([
    getSessionUser(),
    navItems(),
    getSetting("contact_phone", "+62 812 3456 7890"),
    getSetting("contact_whatsapp", "+6281234567890"),
  ]);

  const accountHref =
    user?.role === "ADMIN" ? "/admin" : user?.role === "SUPPLIER" ? "/supplier" : "/account";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      {/* top strip */}
      <div className="hidden bg-brand-900 text-white md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
          <p>🌟 Best Bali Things To Do — trusted local suppliers, instant confirmation</p>
          <div className="flex items-center gap-4">
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-brand-200">
              📞 {phone}
            </a>
            <a
              href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-200"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-2xl">🌴</span>
          <span className="font-display text-lg font-bold leading-tight text-brand-900">
            Bali Things To Do
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-sunset-500">
              Best experiences
            </span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex">
          {items.map((item) => (
            <Link key={item.url + item.title} href={item.url} className="hover:text-brand-700">
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && <NotificationBell />}
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href={accountHref}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
              >
                {user.role === "ADMIN"
                  ? "Admin"
                  : user.role === "SUPPLIER"
                    ? "Supplier"
                    : "My account"}
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 sm:block"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/search"
            className="rounded-xl bg-sunset-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-sunset-600"
          >
            Book now
          </Link>
          <HeaderInteractions />
        </div>
      </div>
    </header>
  );
}
